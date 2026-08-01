import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  GetCategoryParams,
  UpdateCategoryParams,
  DeleteCategoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /categories
router.get("/categories", async (req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(categories);
});

// POST /categories
router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json(category);
});

// GET /categories/:id
router.get("/categories/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetCategoryParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, paramsParsed.data.id));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(category);
});

// PATCH /categories/:id
router.patch("/categories/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateCategoryParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateCategoryBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const [updated] = await db
    .update(categoriesTable)
    .set(bodyParsed.data)
    .where(eq(categoriesTable.id, paramsParsed.data.id))
    .returning();
  res.json(updated);
});

// DELETE /categories/:id
router.delete("/categories/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeleteCategoryParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
