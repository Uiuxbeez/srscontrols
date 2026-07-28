import { Router, type IRouter } from "express";
import { eq, desc, sql, and, like, or } from "drizzle-orm";
import { db, clientsTable, invoicesTable, invoiceItemsTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  DeleteInvoiceParams,
  ListInvoicesQueryParams,
} from "@workspace/api-zod";
import { computeInvoiceTotals } from "../lib/amountInWords";

const router: IRouter = Router();

// GET /invoices/:id/pdf - render invoice page and return a PDF
router.get("/invoices/:id/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params["id"])
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" })
    return
  }

  const invoice = await fetchFullInvoice(id)
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" })
    return
  }

  try {
    // lazily import puppeteer to avoid startup cost when not used
    const puppeteer = await import("puppeteer")
    const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || "http://localhost:5173"
    const target = `${FRONTEND_BASE.replace(/\/$/, "")}/invoices/${id}?pdfRender=1`

    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] })
    const page = await browser.newPage()
    await page.goto(target, { waitUntil: "networkidle0" })
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true })
    await browser.close()

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`)
    res.send(pdfBuffer)
  } catch (err) {
    console.error("PDF generation failed:", err)
    res.status(500).json({ error: "Failed to generate PDF" })
  }
})

// GET /invoices/stats
router.get("/invoices/stats", async (req, res): Promise<void> => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const [totalRow] = await db
    .select({
      totalInvoices: sql<number>`count(*)::int`,
      totalRevenue: sql<number>`coalesce(sum(net_total::numeric), 0)::float`,
    })
    .from(invoicesTable);

  const [thisMonthRow] = await db
    .select({
      thisMonthRevenue: sql<number>`coalesce(sum(net_total::numeric), 0)::float`,
      thisMonthCount: sql<number>`count(*)::int`,
    })
    .from(invoicesTable)
    .where(sql`date >= ${thisMonthStart}`);

  const [lastMonthRow] = await db
    .select({
      lastMonthRevenue: sql<number>`coalesce(sum(net_total::numeric), 0)::float`,
      lastMonthCount: sql<number>`count(*)::int`,
    })
    .from(invoicesTable)
    .where(sql`date >= ${lastMonthStart} and date <= ${lastMonthEnd}`);

  res.json({
    totalInvoices: totalRow?.totalInvoices ?? 0,
    totalRevenue: totalRow?.totalRevenue ?? 0,
    thisMonthRevenue: thisMonthRow?.thisMonthRevenue ?? 0,
    thisMonthCount: thisMonthRow?.thisMonthCount ?? 0,
    lastMonthRevenue: lastMonthRow?.lastMonthRevenue ?? 0,
    lastMonthCount: lastMonthRow?.lastMonthCount ?? 0,
  });
});

// GET /invoices/recent
router.get("/invoices/recent", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      date: invoicesTable.date,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.name,
      workSite: invoicesTable.workSite,
      netTotal: invoicesTable.netTotal,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(5);

  res.json(
    rows.map((r) => ({
      ...r,
      clientName: r.clientName ?? "",
      netTotal: Number(r.netTotal),
    })),
  );
});

// GET /invoices/next-number
router.get("/invoices/next-number", async (req, res): Promise<void> => {
  const [row] = await db
    .select({ maxNo: sql<number>`coalesce(max(invoice_no), 0)::int` })
    .from(invoicesTable);
  res.json({ nextNumber: (row?.maxNo ?? 0) + 1 });
});

// GET /invoices
router.get("/invoices", async (req, res): Promise<void> => {
  const queryParsed = ListInvoicesQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  const { clientId, search } = queryParsed.data;

  const conditions = [];
  if (clientId) conditions.push(eq(invoicesTable.clientId, clientId));
  if (search) {
    conditions.push(
      or(
        like(clientsTable.name, `%${search}%`),
        like(invoicesTable.workSite, `%${search}%`),
      ),
    );
  }

  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      date: invoicesTable.date,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.name,
      workSite: invoicesTable.workSite,
      netTotal: invoicesTable.netTotal,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoicesTable.invoiceNo));

  res.json(
    rows.map((r) => ({
      ...r,
      clientName: r.clientName ?? "",
      netTotal: Number(r.netTotal),
    })),
  );
});

// POST /invoices
router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, cgstRate, sgstRate, ...invoiceData } = parsed.data;
  const totals = computeInvoiceTotals(items, cgstRate, sgstRate);

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      ...invoiceData,
      cgstRate: String(cgstRate),
      sgstRate: String(sgstRate),
      ...totals,
    })
    .returning();

  if (items.length > 0) {
    await db.insert(invoiceItemsTable).values(
      items.map((item) => ({
        invoiceId: invoice!.id,
        sNo: item.sNo,
        description: item.description,
        hsnSac: item.hsnSac,
        qty: item.qty != null ? String(item.qty) : null,
        rate: item.rate != null ? String(item.rate) : null,
        per: item.per,
        amount: String(item.amount),
      })),
    );
  }

  const fullInvoice = await fetchFullInvoice(invoice!.id);
  res.status(201).json(fullInvoice);
});

// GET /invoices/:id
router.get("/invoices/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetInvoiceParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const invoice = await fetchFullInvoice(paramsParsed.data.id);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(invoice);
});

// PATCH /invoices/:id
router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateInvoiceParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateInvoiceBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const { items, cgstRate, sgstRate, ...invoiceData } = bodyParsed.data;

  const updateData: Record<string, unknown> = { ...invoiceData };
  if (cgstRate != null) updateData["cgstRate"] = String(cgstRate);
  if (sgstRate != null) updateData["sgstRate"] = String(sgstRate);

  const effectiveItems = items ?? [];
  const effectiveCgst = cgstRate ?? Number(existing.cgstRate);
  const effectiveSgst = sgstRate ?? Number(existing.sgstRate);

  if (effectiveItems.length > 0 || cgstRate != null || sgstRate != null) {
    const itemsToUse =
      effectiveItems.length > 0
        ? effectiveItems
        : await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, paramsParsed.data.id));
    const totals = computeInvoiceTotals(itemsToUse, effectiveCgst, effectiveSgst);
    Object.assign(updateData, totals);
  }

  await db.update(invoicesTable).set(updateData).where(eq(invoicesTable.id, paramsParsed.data.id));

  if (items && items.length > 0) {
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, paramsParsed.data.id));
    await db.insert(invoiceItemsTable).values(
      items.map((item) => ({
        invoiceId: paramsParsed.data.id,
        sNo: item.sNo,
        description: item.description,
        hsnSac: item.hsnSac,
        qty: item.qty != null ? String(item.qty) : null,
        rate: item.rate != null ? String(item.rate) : null,
        per: item.per,
        amount: String(item.amount),
      })),
    );
  }

  const fullInvoice = await fetchFullInvoice(paramsParsed.data.id);
  res.json(fullInvoice);
});

// DELETE /invoices/:id
router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeleteInvoiceParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  await db.delete(invoicesTable).where(eq(invoicesTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

async function fetchFullInvoice(id: number) {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, id));

  if (!invoice) return null;

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, invoice.clientId));
  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, id))
    .orderBy(invoiceItemsTable.sNo);

  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    cgstRate: Number(invoice.cgstRate),
    sgstRate: Number(invoice.sgstRate),
    cgstAmount: Number(invoice.cgstAmount),
    sgstAmount: Number(invoice.sgstAmount),
    roundOff: Number(invoice.roundOff),
    netTotal: Number(invoice.netTotal),
    client: client ?? null,
    items: items.map((item) => ({
      ...item,
      qty: item.qty != null ? Number(item.qty) : null,
      rate: item.rate != null ? Number(item.rate) : null,
      amount: Number(item.amount),
    })),
  };
}

export default router;
