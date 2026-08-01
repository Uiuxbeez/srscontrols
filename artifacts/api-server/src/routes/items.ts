import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, itemsTable } from "@workspace/db";
import {
  CreateItemBody,
  UpdateItemBody,
  GetItemParams,
  UpdateItemParams,
  DeleteItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toItem(row: typeof itemsTable.$inferSelect) {
  return { ...row, price: row.price != null ? Number(row.price) : null };
}

// GET /items
router.get("/items", async (req, res): Promise<void> => {
  const { subCategoryId } = req.query as Record<string, string | undefined>;
  const query = db.select().from(itemsTable);
  const items = subCategoryId
    ? await query.where(eq(itemsTable.subCategoryId, Number(subCategoryId))).orderBy(itemsTable.name)
    : await query.orderBy(itemsTable.name);
  res.json(items.map(toItem));
});

// POST /items
router.post("/items", async (req, res): Promise<void> => {
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { price, ...rest } = parsed.data;
  const [item] = await db
    .insert(itemsTable)
    .values({ ...rest, price: price != null ? String(price) : undefined })
    .returning();
  res.status(201).json(toItem(item!));
});

// GET /items/:id
router.get("/items/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetItemParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [item] = await db.select().from(itemsTable).where(eq(itemsTable.id, paramsParsed.data.id));
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(toItem(item));
});

// PATCH /items/:id
router.patch("/items/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateItemParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateItemBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db.select().from(itemsTable).where(eq(itemsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const { price, ...rest } = bodyParsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (price != null) updateData["price"] = String(price);
  const [updated] = await db
    .update(itemsTable)
    .set(updateData)
    .where(eq(itemsTable.id, paramsParsed.data.id))
    .returning();
  res.json(toItem(updated!));
});

// DELETE /items/:id
router.delete("/items/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeleteItemParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(itemsTable).where(eq(itemsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  await db.delete(itemsTable).where(eq(itemsTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
