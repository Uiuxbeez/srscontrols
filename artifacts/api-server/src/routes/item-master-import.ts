import { Router, type IRouter, type RequestHandler } from "express";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import { db, categoriesTable, subCategoriesTable, itemsTable } from "@workspace/db";
import { z } from "zod";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are supported"));
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

// POST /item-master/parse-pdf
router.post("/item-master/parse-pdf", uploadSingle, async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  try {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(file.buffer) }).promise;
    const worker = await createWorker("eng");
    const pages: { pageNumber: number; lines: string[] }[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2.5 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvas: canvas as never, canvasContext: ctx as never, viewport }).promise;
      const pngBuffer = await canvas.encode("png");
      const { data } = await worker.recognize(pngBuffer);
      const lines = data.text.split("\n").map((l) => l.trim()).filter(Boolean);
      pages.push({ pageNumber: i, lines });
    }
    await worker.terminate();
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to read PDF" });
  }
});

const ImportItemSchema = z.object({
  name: z.string().min(1),
  catNo: z.string().optional(),
  price: z.number().nullable().optional(),
  packQty: z.number().int().nullable().optional(),
  specifications: z.string().optional(),
});

const ImportBody = z.object({
  categoryName: z.string().min(1),
  subCategories: z
    .array(
      z.object({
        name: z.string().min(1),
        items: z.array(ImportItemSchema).min(1),
      }),
    )
    .min(1),
});

// POST /item-master/import
router.post("/item-master/import", async (req, res): Promise<void> => {
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { categoryName, subCategories } = parsed.data;

  let [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.name, categoryName));
  if (!category) {
    [category] = await db.insert(categoriesTable).values({ name: categoryName }).returning();
  }

  const resultSubCategories = [];
  for (const sub of subCategories) {
    let [subCategory] = await db
      .select()
      .from(subCategoriesTable)
      .where(and(eq(subCategoriesTable.categoryId, category!.id), eq(subCategoriesTable.name, sub.name)));
    if (!subCategory) {
      [subCategory] = await db
        .insert(subCategoriesTable)
        .values({ categoryId: category!.id, name: sub.name })
        .returning();
    }
    const insertedItems = await db
      .insert(itemsTable)
      .values(
        sub.items.map((item) => ({
          subCategoryId: subCategory!.id,
          name: item.name,
          catNo: item.catNo ?? "",
          price: item.price != null ? String(item.price) : null,
          packQty: item.packQty ?? null,
          specifications: item.specifications ?? "",
        })),
      )
      .returning();
    resultSubCategories.push({
      ...subCategory,
      items: insertedItems.map((item) => ({ ...item, price: item.price != null ? Number(item.price) : null })),
    });
  }

  res.status(201).json({ ...category, subCategories: resultSubCategories });
});

export default router;
