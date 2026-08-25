import { Router, type IRouter } from "express";
import { eq, desc, sql, and, like, type SQL } from "drizzle-orm";
import { db, clientsTable, purchaseOrdersTable, purchaseOrderItemsTable, purchaseItemMasterTable } from "@workspace/db";
import {
  CreatePurchaseOrderBody,
  UpdatePurchaseOrderBody,
  GetPurchaseOrderParams,
  UpdatePurchaseOrderParams,
  DeletePurchaseOrderParams,
  ListPurchaseOrdersQueryParams,
} from "@workspace/api-zod";
import { computeInvoiceTotals } from "../lib/amountInWords";

const router: IRouter = Router();

// Every item saved on a PO is also saved to that client's Purchase Item Master (if not
// already there, matched case-insensitively) so it can be quickly re-picked next time.
async function syncItemsToMaster(
  clientId: number,
  items: { description: string; rate?: number | null; per?: string | null; discountPct?: number | null }[],
) {
  if (items.length === 0) return;

  const existing = await db
    .select({ description: purchaseItemMasterTable.description })
    .from(purchaseItemMasterTable)
    .where(eq(purchaseItemMasterTable.clientId, clientId));
  const seen = new Set(existing.map((e) => e.description.trim().toLowerCase()));

  const toInsert: (typeof purchaseItemMasterTable.$inferInsert)[] = [];
  for (const item of items) {
    const description = item.description?.trim();
    if (!description) continue;
    const key = description.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    toInsert.push({
      clientId,
      description,
      rate: item.rate != null ? String(item.rate) : null,
      per: item.per ?? null,
      discountPct: item.discountPct != null ? String(item.discountPct) : null,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(purchaseItemMasterTable).values(toInsert).onConflictDoNothing();
  }
}

// GET /purchase-orders/next-number
router.get("/purchase-orders/next-number", async (req, res): Promise<void> => {
  const [row] = await db
    .select({ maxNo: sql<number>`coalesce(max(po_no), 0)::int` })
    .from(purchaseOrdersTable);
  res.json({ nextNumber: (row?.maxNo ?? 0) + 1 });
});

// GET /purchase-orders
router.get("/purchase-orders", async (req, res): Promise<void> => {
  const queryParsed = ListPurchaseOrdersQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  const { clientId, search } = queryParsed.data;

  const conditions: (SQL | undefined)[] = [];
  if (clientId) conditions.push(eq(purchaseOrdersTable.clientId, clientId));
  if (search) conditions.push(like(clientsTable.name, `%${search}%`));

  const rows = await db
    .select({
      id: purchaseOrdersTable.id,
      poNo: purchaseOrdersTable.poNo,
      date: purchaseOrdersTable.date,
      clientId: purchaseOrdersTable.clientId,
      clientName: clientsTable.name,
      netTotal: purchaseOrdersTable.netTotal,
      createdAt: purchaseOrdersTable.createdAt,
    })
    .from(purchaseOrdersTable)
    .leftJoin(clientsTable, eq(purchaseOrdersTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(purchaseOrdersTable.poNo));

  res.json(
    rows.map((r) => ({
      ...r,
      clientName: r.clientName ?? "",
      netTotal: Number(r.netTotal),
    })),
  );
});

// POST /purchase-orders
router.post("/purchase-orders", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, cgstRate, sgstRate, ...poData } = parsed.data;
  const totals = computeInvoiceTotals(items, cgstRate, sgstRate);

  const [po] = await db
    .insert(purchaseOrdersTable)
    .values({
      ...poData,
      cgstRate: String(cgstRate),
      sgstRate: String(sgstRate),
      ...totals,
    })
    .returning();

  if (items.length > 0) {
    await db.insert(purchaseOrderItemsTable).values(
      items.map((item) => ({
        purchaseOrderId: po!.id,
        sNo: item.sNo,
        description: item.description,
        discountPct: item.discountPct != null ? String(item.discountPct) : null,
        qty: item.qty != null ? String(item.qty) : null,
        rate: item.rate != null ? String(item.rate) : null,
        per: item.per,
        amount: String(item.amount),
      })),
    );
    await syncItemsToMaster(po!.clientId, items);
  }

  const fullPo = await fetchFullPurchaseOrder(po!.id);
  res.status(201).json(fullPo);
});

// GET /purchase-orders/:id
router.get("/purchase-orders/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetPurchaseOrderParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const po = await fetchFullPurchaseOrder(paramsParsed.data.id);
  if (!po) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }
  res.json(po);
});

// PATCH /purchase-orders/:id
router.patch("/purchase-orders/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdatePurchaseOrderParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdatePurchaseOrderBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  const { items, cgstRate, sgstRate, ...poData } = bodyParsed.data;

  const updateData: Record<string, unknown> = { ...poData };
  if (cgstRate != null) updateData["cgstRate"] = String(cgstRate);
  if (sgstRate != null) updateData["sgstRate"] = String(sgstRate);

  const effectiveItems = items ?? [];
  const effectiveCgst = cgstRate ?? Number(existing.cgstRate);
  const effectiveSgst = sgstRate ?? Number(existing.sgstRate);

  if (effectiveItems.length > 0 || cgstRate != null || sgstRate != null) {
    const itemsToUse =
      effectiveItems.length > 0
        ? effectiveItems
        : await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, paramsParsed.data.id));
    const totals = computeInvoiceTotals(itemsToUse, effectiveCgst, effectiveSgst);
    Object.assign(updateData, totals);
  }

  await db.update(purchaseOrdersTable).set(updateData).where(eq(purchaseOrdersTable.id, paramsParsed.data.id));

  if (items && items.length > 0) {
    await db.delete(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, paramsParsed.data.id));
    await db.insert(purchaseOrderItemsTable).values(
      items.map((item) => ({
        purchaseOrderId: paramsParsed.data.id,
        sNo: item.sNo,
        description: item.description,
        discountPct: item.discountPct != null ? String(item.discountPct) : null,
        qty: item.qty != null ? String(item.qty) : null,
        rate: item.rate != null ? String(item.rate) : null,
        per: item.per,
        amount: String(item.amount),
      })),
    );
    await syncItemsToMaster(poData.clientId ?? existing.clientId, items);
  }

  const fullPo = await fetchFullPurchaseOrder(paramsParsed.data.id);
  res.json(fullPo);
});

// DELETE /purchase-orders/:id
router.delete("/purchase-orders/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeletePurchaseOrderParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }
  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

async function fetchFullPurchaseOrder(id: number) {
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) return null;

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, po.clientId));
  const items = await db
    .select()
    .from(purchaseOrderItemsTable)
    .where(eq(purchaseOrderItemsTable.purchaseOrderId, id))
    .orderBy(purchaseOrderItemsTable.sNo);

  return {
    ...po,
    subtotal: Number(po.subtotal),
    cgstRate: Number(po.cgstRate),
    sgstRate: Number(po.sgstRate),
    cgstAmount: Number(po.cgstAmount),
    sgstAmount: Number(po.sgstAmount),
    roundOff: Number(po.roundOff),
    netTotal: Number(po.netTotal),
    client: client ?? null,
    items: items.map((item) => ({
      ...item,
      discountPct: item.discountPct != null ? Number(item.discountPct) : null,
      qty: item.qty != null ? Number(item.qty) : null,
      rate: item.rate != null ? Number(item.rate) : null,
      amount: Number(item.amount),
    })),
  };
}

export default router;
