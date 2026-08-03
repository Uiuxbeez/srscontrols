import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
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

const BulkImportBody = z.object({
  panelName: z.string().min(1),
  components: z
    .array(
      z.object({
        component: z.string().min(1),
        note: z.string().optional().default(""),
      }),
    )
    .min(1),
});

// POST /panels/bulk-import — appends component breakdown lines to one named panel
// (creating it if it doesn't exist yet); duplicate lines already on the panel are skipped.
router.post("/panels/bulk-import", async (req, res): Promise<void> => {
  const parsed = BulkImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const panelName = parsed.data.panelName.trim();

  const [existing] = await db.select().from(panelsTable).where(eq(panelsTable.name, panelName));
  const existingLines = existing ? existing.breakdownText.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  const seen = new Set(existingLines.map((l) => l.toLowerCase()));

  const newLines: string[] = [];
  const skipped: string[] = [];
  for (const c of parsed.data.components) {
    const component = c.component.trim();
    const note = c.note.trim();
    const line = note ? `${component} - ${note}` : component;
    const key = line.toLowerCase();
    if (seen.has(key)) {
      skipped.push(line);
      continue;
    }
    seen.add(key);
    newLines.push(line);
  }

  const combinedText = [...existingLines, ...newLines].join("\n");

  const [panel] = existing
    ? await db.update(panelsTable).set({ breakdownText: combinedText }).where(eq(panelsTable.id, existing.id)).returning()
    : await db.insert(panelsTable).values({ name: panelName, breakdownText: combinedText }).returning();

  res.status(201).json({ panel: toPanel(panel!), added: newLines.length, skipped, created: !existing });
});

export default router;
