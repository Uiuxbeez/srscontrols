import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subCategoriesTable } from "@workspace/db";
import {
  CreateSubCategoryBody,
  UpdateSubCategoryBody,
  GetSubCategoryParams,
  UpdateSubCategoryParams,
  DeleteSubCategoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /sub-categories
router.get("/sub-categories", async (req, res): Promise<void> => {
  const { categoryId } = req.query as Record<string, string | undefined>;
  const query = db.select().from(subCategoriesTable);
  const subCategories = categoryId
    ? await query.where(eq(subCategoriesTable.categoryId, Number(categoryId))).orderBy(subCategoriesTable.name)
    : await query.orderBy(subCategoriesTable.name);
  res.json(subCategories);
});

// POST /sub-categories
router.post("/sub-categories", async (req, res): Promise<void> => {
  const parsed = CreateSubCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [subCategory] = await db.insert(subCategoriesTable).values(parsed.data).returning();
  res.status(201).json(subCategory);
});

// GET /sub-categories/:id
router.get("/sub-categories/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetSubCategoryParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [subCategory] = await db
    .select()
    .from(subCategoriesTable)
    .where(eq(subCategoriesTable.id, paramsParsed.data.id));
  if (!subCategory) {
    res.status(404).json({ error: "Sub-category not found" });
    return;
  }
  res.json(subCategory);
});

// PATCH /sub-categories/:id
router.patch("/sub-categories/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateSubCategoryParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateSubCategoryBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(subCategoriesTable)
    .where(eq(subCategoriesTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Sub-category not found" });
    return;
  }
  const [updated] = await db
    .update(subCategoriesTable)
    .set(bodyParsed.data)
    .where(eq(subCategoriesTable.id, paramsParsed.data.id))
    .returning();
  res.json(updated);
});

// DELETE /sub-categories/:id
router.delete("/sub-categories/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeleteSubCategoryParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db
    .select()
    .from(subCategoriesTable)
    .where(eq(subCategoriesTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Sub-category not found" });
    return;
  }
  await db.delete(subCategoriesTable).where(eq(subCategoriesTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
