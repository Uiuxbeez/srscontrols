import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, techSpecItemsTable } from "@workspace/db";
import {
  CreateTechSpecItemBody,
  UpdateTechSpecItemBody,
  GetTechSpecItemParams,
  UpdateTechSpecItemParams,
  DeleteTechSpecItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /tech-spec-items
router.get("/tech-spec-items", async (req, res): Promise<void> => {
  const items = await db.select().from(techSpecItemsTable).orderBy(techSpecItemsTable.itemName);
  res.json(items);
});

// POST /tech-spec-items
router.post("/tech-spec-items", async (req, res): Promise<void> => {
  const parsed = CreateTechSpecItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(techSpecItemsTable).values(parsed.data).returning();
  res.status(201).json(item);
});

// GET /tech-spec-items/:id
router.get("/tech-spec-items/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetTechSpecItemParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [item] = await db
    .select()
    .from(techSpecItemsTable)
    .where(eq(techSpecItemsTable.id, paramsParsed.data.id));
  if (!item) {
    res.status(404).json({ error: "Tech spec item not found" });
    return;
  }
  res.json(item);
});

// PATCH /tech-spec-items/:id
router.patch("/tech-spec-items/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateTechSpecItemParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateTechSpecItemBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(techSpecItemsTable)
    .where(eq(techSpecItemsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Tech spec item not found" });
    return;
  }
  const [updated] = await db
    .update(techSpecItemsTable)
    .set(bodyParsed.data)
    .where(eq(techSpecItemsTable.id, paramsParsed.data.id))
    .returning();
  res.json(updated);
});

// DELETE /tech-spec-items/:id
router.delete("/tech-spec-items/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeleteTechSpecItemParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db
    .select()
    .from(techSpecItemsTable)
    .where(eq(techSpecItemsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Tech spec item not found" });
    return;
  }
  await db.delete(techSpecItemsTable).where(eq(techSpecItemsTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
