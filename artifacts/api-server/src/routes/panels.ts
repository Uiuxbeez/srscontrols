import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, panelsTable } from "@workspace/db";
import {
  CreatePanelBody,
  UpdatePanelBody,
  GetPanelParams,
  UpdatePanelParams,
  DeletePanelParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toPanel(row: typeof panelsTable.$inferSelect) {
  return { ...row, price: Number(row.price) };
}

// GET /panels
router.get("/panels", async (req, res): Promise<void> => {
  const panels = await db.select().from(panelsTable).orderBy(panelsTable.name);
  res.json(panels.map(toPanel));
});

// POST /panels
router.post("/panels", async (req, res): Promise<void> => {
  const parsed = CreatePanelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { price, ...rest } = parsed.data;
  const [panel] = await db
    .insert(panelsTable)
    .values({ ...rest, price: price != null ? String(price) : undefined })
    .returning();
  res.status(201).json(toPanel(panel!));
});

// GET /panels/:id
router.get("/panels/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetPanelParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, paramsParsed.data.id));
  if (!panel) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  res.json(toPanel(panel));
});

// PATCH /panels/:id
router.patch("/panels/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdatePanelParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdatePanelBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db.select().from(panelsTable).where(eq(panelsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  const { price, ...rest } = bodyParsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (price != null) updateData["price"] = String(price);
  const [updated] = await db
    .update(panelsTable)
    .set(updateData)
    .where(eq(panelsTable.id, paramsParsed.data.id))
    .returning();
  res.json(toPanel(updated!));
});

// DELETE /panels/:id
router.delete("/panels/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeletePanelParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(panelsTable).where(eq(panelsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  await db.delete(panelsTable).where(eq(panelsTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
