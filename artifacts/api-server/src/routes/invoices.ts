import { Router, type IRouter } from "express";
import { eq, desc, sql, and, like, or, gte, lt, type SQL } from "drizzle-orm";
import { db, clientsTable, suppliersTable, invoicesTable, invoiceItemsTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  DeleteInvoiceParams,
  ListInvoicesQueryParams,
} from "@workspace/api-zod";
import { computeInvoiceTotals } from "../lib/amountInWords";
import { SESSION_COOKIE, signSession } from "../middlewares/require-auth";

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
    const routeBase = invoice.documentType === "proforma" ? "proforma-invoices" : "invoices"
    const target = `${FRONTEND_BASE.replace(/\/$/, "")}/${routeBase}/${id}?pdfRender=1`

    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] })
    const page = await browser.newPage()
    // The headless browser has no session of its own — forward the caller's
    // identity (this route is already behind requireAuth) so the rendered
    // page's own API calls don't get bounced to the login screen.
    if (req.user) {
      await page.setCookie({
        name: SESSION_COOKIE,
        value: signSession(req.user),
        url: FRONTEND_BASE,
      })
    }
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

// SRS Controls' own GST state-code prefix (Tamil Nadu) — mirrors artifacts/invoice-app/src/lib/gst.ts.
// A client GSTIN starting with anything else means that invoice's tax is IGST, not CGST+SGST.
const HOME_STATE_CODE = "33";

// GET /invoices/stats
router.get("/invoices/stats", async (req, res): Promise<void> => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  // Proforma invoices are pre-sale documents, not actual revenue — every query here is
  // scoped to real Invoices only so Dashboard numbers stay accurate.
  const isRealInvoice = eq(invoicesTable.documentType, "invoice");

  const [totalRow] = await db
    .select({
      totalInvoices: sql<number>`count(*)::int`,
      totalRevenue: sql<number>`coalesce(sum(net_total::numeric), 0)::float`,
    })
    .from(invoicesTable)
    .where(isRealInvoice);

  const [thisMonthRow] = await db
    .select({
      thisMonthRevenue: sql<number>`coalesce(sum(net_total::numeric), 0)::float`,
      thisMonthCount: sql<number>`count(*)::int`,
    })
    .from(invoicesTable)
    .where(and(isRealInvoice, sql`date >= ${thisMonthStart}`));

  const [lastMonthRow] = await db
    .select({
      lastMonthRevenue: sql<number>`coalesce(sum(net_total::numeric), 0)::float`,
      lastMonthCount: sql<number>`count(*)::int`,
    })
    .from(invoicesTable)
    .where(and(isRealInvoice, sql`date >= ${lastMonthStart} and date <= ${lastMonthEnd}`));

  const [taxRow] = await db
    .select({
      subtotal: sql<number>`coalesce(sum(${invoicesTable.subtotal}::numeric), 0)::float`,
      cgst: sql<number>`coalesce(sum(case when ${clientsTable.gstin} is null or left(${clientsTable.gstin}, 2) = ${HOME_STATE_CODE} then ${invoicesTable.cgstAmount}::numeric else 0 end), 0)::float`,
      sgst: sql<number>`coalesce(sum(case when ${clientsTable.gstin} is null or left(${clientsTable.gstin}, 2) = ${HOME_STATE_CODE} then ${invoicesTable.sgstAmount}::numeric else 0 end), 0)::float`,
      igst: sql<number>`coalesce(sum(case when ${clientsTable.gstin} is not null and left(${clientsTable.gstin}, 2) != ${HOME_STATE_CODE} then (${invoicesTable.cgstAmount}::numeric + ${invoicesTable.sgstAmount}::numeric) else 0 end), 0)::float`,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(and(isRealInvoice, gte(invoicesTable.date, thisMonthStart), lt(invoicesTable.date, nextMonthStart)));

  res.json({
    totalInvoices: totalRow?.totalInvoices ?? 0,
    totalRevenue: totalRow?.totalRevenue ?? 0,
    thisMonthRevenue: thisMonthRow?.thisMonthRevenue ?? 0,
    thisMonthCount: thisMonthRow?.thisMonthCount ?? 0,
    lastMonthRevenue: lastMonthRow?.lastMonthRevenue ?? 0,
    lastMonthCount: lastMonthRow?.lastMonthCount ?? 0,
    thisMonthSubtotal: taxRow?.subtotal ?? 0,
    thisMonthCgst: taxRow?.cgst ?? 0,
    thisMonthSgst: taxRow?.sgst ?? 0,
    thisMonthIgst: taxRow?.igst ?? 0,
    thisMonthTax: (taxRow?.cgst ?? 0) + (taxRow?.sgst ?? 0) + (taxRow?.igst ?? 0),
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
    .where(eq(invoicesTable.documentType, "invoice"))
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
  const documentType = req.query["documentType"] === "proforma" ? "proforma" : "invoice";
  const [row] = await db
    .select({ maxNo: sql<number>`coalesce(max(invoice_no), 0)::int` })
    .from(invoicesTable)
    .where(eq(invoicesTable.documentType, documentType));
  res.json({ nextNumber: (row?.maxNo ?? 0) + 1 });
});

// GET /invoices
router.get("/invoices", async (req, res): Promise<void> => {
  const queryParsed = ListInvoicesQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  const { clientId, search, documentType } = queryParsed.data;

  const conditions: (SQL | undefined)[] = [eq(invoicesTable.documentType, documentType === "proforma" ? "proforma" : "invoice")];
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
  const [supplier] = invoice.supplierId
    ? await db.select().from(suppliersTable).where(eq(suppliersTable.id, invoice.supplierId))
    : [];
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
    supplier: supplier ?? null,
    items: items.map((item) => ({
      ...item,
      qty: item.qty != null ? Number(item.qty) : null,
      rate: item.rate != null ? Number(item.rate) : null,
      amount: Number(item.amount),
    })),
  };
}

export default router;
