import { Router, type IRouter } from "express";
import { eq, desc, sql, like, and, or } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import { quotationsTable, quotationItemsTable } from "@workspace/db/schema";
import { z } from "zod";
import { numberToWords } from "../lib/amountInWords";

const router: IRouter = Router();

/* ─── Zod schemas ─── */
const ItemSchema = z.object({
  sNo: z.number().int().min(1),
  description: z.string().min(1),
  qty: z.number().nullable().optional(),
  rate: z.number().nullable().optional(),
  amount: z.number(),
});

const CreateQuotationBody = z.object({
  quotationNo: z.string().min(1),
  date: z.string().min(1),
  clientId: z.number().int().min(1),
  subject: z.string().optional(),
  discountPct: z.number().min(0).max(100).default(0),
  gstRate: z.number().min(0).max(100).default(18),
  termsAdvance: z.string().optional(),
  termsDelivery: z.string().optional(),
  termsTransport: z.string().optional(),
  termsTax: z.string().optional(),
  termsValidity: z.string().optional(),
  termsWarranty: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(ItemSchema).min(1),
});

const UpdateQuotationBody = CreateQuotationBody.partial();

/* ─── Totals helper ─── */
function computeQuotationTotals(
  items: Array<{ amount: number | string }>,
  discountPct: number,
  gstRate: number,
) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const discountAmount = (subtotal * discountPct) / 100;
  const afterDiscountTotal = subtotal - discountAmount;
  const gstAmount = (afterDiscountTotal * gstRate) / 100;
  const gross = afterDiscountTotal + gstAmount;
  const grandTotal = Math.round(gross);
  const roundOff = grandTotal - gross;
  const amountInWords = numberToWords(grandTotal);
  return {
    subtotal: subtotal.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    afterDiscountTotal: afterDiscountTotal.toFixed(2),
    gstAmount: gstAmount.toFixed(2),
    roundOff: roundOff.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    amountInWords,
  };
}

/* ─── Helper: fetch full quotation with client + items ─── */
async function fetchFullQuotation(id: number) {
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) return null;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, q.clientId));
  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, id))
    .orderBy(quotationItemsTable.sNo);

  return {
    ...q,
    discountPct: Number(q.discountPct),
    gstRate: Number(q.gstRate),
    subtotal: Number(q.subtotal),
    discountAmount: Number(q.discountAmount),
    afterDiscountTotal: Number(q.afterDiscountTotal),
    gstAmount: Number(q.gstAmount),
    roundOff: Number(q.roundOff),
    grandTotal: Number(q.grandTotal),
    client: client ?? null,
    items: items.map((item) => ({
      ...item,
      qty: item.qty != null ? Number(item.qty) : null,
      rate: item.rate != null ? Number(item.rate) : null,
      amount: Number(item.amount),
    })),
  };
}

/* ─── GET /quotations/next-number ─── */
router.get("/quotations/next-number", async (req, res): Promise<void> => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const nextYY = String(now.getFullYear() + 1).slice(-2);
  const [row] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(quotationsTable);
  const seq = (row?.cnt ?? 0) + 1;
  res.json({ nextNumber: `R-${seq}/${yy}-${nextYY}` });
});

/* ─── GET /quotations ─── */
router.get("/quotations", async (req, res): Promise<void> => {
  const { search, clientId } = req.query as Record<string, string | undefined>;
  const conditions: ReturnType<typeof eq>[] = [];
  if (clientId) conditions.push(eq(quotationsTable.clientId, Number(clientId)) as any);
  if (search) {
    conditions.push(
      or(
        like(clientsTable.name, `%${search}%`),
        like(quotationsTable.quotationNo, `%${search}%`),
        like(quotationsTable.subject, `%${search}%`),
      ) as any,
    );
  }

  const rows = await db
    .select({
      id: quotationsTable.id,
      quotationNo: quotationsTable.quotationNo,
      date: quotationsTable.date,
      clientId: quotationsTable.clientId,
      clientName: clientsTable.name,
      subject: quotationsTable.subject,
      grandTotal: quotationsTable.grandTotal,
      createdAt: quotationsTable.createdAt,
    })
    .from(quotationsTable)
    .leftJoin(clientsTable, eq(quotationsTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(quotationsTable.createdAt));

  res.json(rows.map((r) => ({ ...r, clientName: r.clientName ?? "", grandTotal: Number(r.grandTotal) })));
});

/* ─── POST /quotations ─── */
router.post("/quotations", async (req, res): Promise<void> => {
  const parsed = CreateQuotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { items, discountPct, gstRate, ...data } = parsed.data;
  const totals = computeQuotationTotals(items, discountPct, gstRate);

  const [q] = await db
    .insert(quotationsTable)
    .values({
      ...data,
      discountPct: String(discountPct),
      gstRate: String(gstRate),
      ...totals,
    })
    .returning();

  await db.insert(quotationItemsTable).values(
    items.map((item) => ({
      quotationId: q!.id,
      sNo: item.sNo,
      description: item.description,
      qty: item.qty != null ? String(item.qty) : null,
      rate: item.rate != null ? String(item.rate) : null,
      amount: String(item.amount),
    })),
  );

  res.status(201).json(await fetchFullQuotation(q!.id));
});

/* ─── GET /quotations/:id ─── */
router.get("/quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const q = await fetchFullQuotation(id);
  if (!q) { res.status(404).json({ error: "Quotation not found" }); return; }
  res.json(q);
});

/* ─── PATCH /quotations/:id ─── */
router.patch("/quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateQuotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }

  const { items, discountPct, gstRate, ...rest } = parsed.data;

  const effectiveDiscount = discountPct ?? Number(existing.discountPct);
  const effectiveGst = gstRate ?? Number(existing.gstRate);

  const updateData: Record<string, unknown> = { ...rest };
  if (discountPct != null) updateData["discountPct"] = String(discountPct);
  if (gstRate != null) updateData["gstRate"] = String(gstRate);

  if (items && items.length > 0) {
    const totals = computeQuotationTotals(items, effectiveDiscount, effectiveGst);
    Object.assign(updateData, totals);
    await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
    await db.insert(quotationItemsTable).values(
      items.map((item) => ({
        quotationId: id,
        sNo: item.sNo,
        description: item.description,
        qty: item.qty != null ? String(item.qty) : null,
        rate: item.rate != null ? String(item.rate) : null,
        amount: String(item.amount),
      })),
    );
  } else if (discountPct != null || gstRate != null) {
    const existingItems = await db
      .select()
      .from(quotationItemsTable)
      .where(eq(quotationItemsTable.quotationId, id));
    const totals = computeQuotationTotals(existingItems, effectiveDiscount, effectiveGst);
    Object.assign(updateData, totals);
  }

  await db.update(quotationsTable).set(updateData).where(eq(quotationsTable.id, id));
  res.json(await fetchFullQuotation(id));
});

/* ─── DELETE /quotations/:id ─── */
router.delete("/quotations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Quotation not found" }); return; }
  await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
  res.json({ success: true });
});

export default router;
