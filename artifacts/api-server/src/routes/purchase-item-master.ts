import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, purchaseItemMasterTable } from "@workspace/db";
import {
  CreatePurchaseItemMasterBody,
  UpdatePurchaseItemMasterBody,
  GetPurchaseItemMasterParams,
  UpdatePurchaseItemMasterParams,
  DeletePurchaseItemMasterParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toEntry(row: typeof purchaseItemMasterTable.$inferSelect) {
  return {
    ...row,
    rate: row.rate != null ? Number(row.rate) : null,
    discountPct: row.discountPct != null ? Number(row.discountPct) : null,
  };
}

// GET /purchase-item-master
router.get("/purchase-item-master", async (req, res): Promise<void> => {
  const { clientId } = req.query as Record<string, string | undefined>;
  const query = db.select().from(purchaseItemMasterTable);
  const rows = clientId
    ? await query.where(eq(purchaseItemMasterTable.clientId, Number(clientId))).orderBy(purchaseItemMasterTable.description)
    : await query.orderBy(purchaseItemMasterTable.description);
  res.json(rows.map(toEntry));
});

// POST /purchase-item-master
router.post("/purchase-item-master", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseItemMasterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { rate, discountPct, ...rest } = parsed.data;
  const [entry] = await db
    .insert(purchaseItemMasterTable)
    .values({
      ...rest,
      rate: rate != null ? String(rate) : undefined,
      discountPct: discountPct != null ? String(discountPct) : undefined,
    })
    .returning();
  res.status(201).json(toEntry(entry!));
});

// GET /purchase-item-master/:id
router.get("/purchase-item-master/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetPurchaseItemMasterParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [entry] = await db.select().from(purchaseItemMasterTable).where(eq(purchaseItemMasterTable.id, paramsParsed.data.id));
  if (!entry) {
    res.status(404).json({ error: "Purchase item master entry not found" });
    return;
  }
  res.json(toEntry(entry));
});

// PATCH /purchase-item-master/:id
router.patch("/purchase-item-master/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdatePurchaseItemMasterParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdatePurchaseItemMasterBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db.select().from(purchaseItemMasterTable).where(eq(purchaseItemMasterTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Purchase item master entry not found" });
    return;
  }
  const { rate, discountPct, ...rest } = bodyParsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (rate != null) updateData["rate"] = String(rate);
  if (discountPct != null) updateData["discountPct"] = String(discountPct);
  const [updated] = await db
    .update(purchaseItemMasterTable)
    .set(updateData)
    .where(eq(purchaseItemMasterTable.id, paramsParsed.data.id))
    .returning();
  res.json(toEntry(updated!));
});

// DELETE /purchase-item-master/:id
router.delete("/purchase-item-master/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeletePurchaseItemMasterParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(purchaseItemMasterTable).where(eq(purchaseItemMasterTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Purchase item master entry not found" });
    return;
  }
  await db.delete(purchaseItemMasterTable).where(eq(purchaseItemMasterTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
