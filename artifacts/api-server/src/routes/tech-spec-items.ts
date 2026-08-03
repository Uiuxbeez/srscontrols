import { Router, type IRouter, type RequestHandler } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db, techSpecItemsTable } from "@workspace/db";
import {
  CreateTechSpecItemBody,
  UpdateTechSpecItemBody,
  GetTechSpecItemParams,
  UpdateTechSpecItemParams,
  DeleteTechSpecItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, GIF, or WEBP images are supported"));
      return;
    }
    cb(null, true);
  },
});

const uploadSingle: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
      return;
    }
    next();
  });
};

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

const PARSE_IMAGE_PROMPT = `This image is a technical specification sheet listing components/items and their default specification text (often a numbered list like "1. SHEET - Tata Sheet usage only" or a two-column table).

Extract every item row as a JSON array of objects: [{"itemName": "...", "defaultSpec": "..."}, ...]
- Read the item name and its associated specification text as written, fixing obvious character-recognition mistakes using context.
- Strip list numbering (e.g. "1.", "12)") from itemName.
- Skip section titles/headers that are not actual item rows (e.g. "TECHNICAL SPECIFICATION").
- Respond with ONLY the JSON array — no markdown fences, no explanation.`;

const ParsedItemSchema = z.array(
  z.object({
    itemName: z.string().min(1),
    defaultSpec: z.string().default(""),
  }),
);

// POST /tech-spec-items/parse-image
router.post("/tech-spec-items/parse-image", uploadSingle, async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });
    return;
  }
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: file.buffer.toString("base64"),
              },
            },
            { type: "text", text: PARSE_IMAGE_PROMPT },
          ],
        },
      ],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.text.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const items = ParsedItemSchema.parse(JSON.parse(cleaned));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to read image" });
  }
});

const BulkImportBody = z.object({
  items: z
    .array(
      z.object({
        itemName: z.string().min(1),
        defaultSpec: z.string().min(1),
      }),
    )
    .min(1),
});

// POST /tech-spec-items/bulk-import
router.post("/tech-spec-items/bulk-import", async (req, res): Promise<void> => {
  const parsed = BulkImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select({ itemName: techSpecItemsTable.itemName }).from(techSpecItemsTable);
  const seen = new Set(existing.map((e) => e.itemName.trim().toLowerCase()));

  const toInsert: { itemName: string; defaultSpec: string }[] = [];
  const skipped: string[] = [];
  for (const item of parsed.data.items) {
    const key = item.itemName.trim().toLowerCase();
    if (seen.has(key)) {
      skipped.push(item.itemName);
      continue;
    }
    seen.add(key);
    toInsert.push({ itemName: item.itemName.trim(), defaultSpec: item.defaultSpec.trim() });
  }

  const inserted = toInsert.length ? await db.insert(techSpecItemsTable).values(toInsert).returning() : [];
  res.status(201).json({ inserted, skipped });
});

export default router;
