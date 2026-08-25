import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, suppliersTable } from "@workspace/db";
import {
  CreateSupplierBody,
  UpdateSupplierBody,
  GetSupplierParams,
  UpdateSupplierParams,
  DeleteSupplierParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /suppliers
router.get("/suppliers", async (req, res): Promise<void> => {
  const suppliers = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  res.json(suppliers);
});

// POST /suppliers
router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.insert(suppliersTable).values(parsed.data).returning();
  res.status(201).json(supplier);
});

// GET /suppliers/:id
router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetSupplierParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, paramsParsed.data.id));
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(supplier);
});

// PATCH /suppliers/:id
router.patch("/suppliers/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateSupplierParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateSupplierBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  const [updated] = await db
    .update(suppliersTable)
    .set(bodyParsed.data)
    .where(eq(suppliersTable.id, paramsParsed.data.id))
    .returning();
  res.json(updated);
});

// DELETE /suppliers/:id
router.delete("/suppliers/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeleteSupplierParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  await db.delete(suppliersTable).where(eq(suppliersTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
