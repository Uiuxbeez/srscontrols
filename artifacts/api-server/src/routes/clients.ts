import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import {
  CreateClientBody,
  UpdateClientBody,
  GetClientParams,
  UpdateClientParams,
  DeleteClientParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /clients
router.get("/clients", async (req, res): Promise<void> => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.name);
  res.json(clients);
});

// POST /clients
router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db.insert(clientsTable).values(parsed.data).returning();
  res.status(201).json(client);
});

// GET /clients/:id
router.get("/clients/:id", async (req, res): Promise<void> => {
  const paramsParsed = GetClientParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, paramsParsed.data.id));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(client);
});

// PATCH /clients/:id
router.patch("/clients/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateClientParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateClientBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const [updated] = await db
    .update(clientsTable)
    .set(bodyParsed.data)
    .where(eq(clientsTable.id, paramsParsed.data.id))
    .returning();
  res.json(updated);
});

// DELETE /clients/:id
router.delete("/clients/:id", async (req, res): Promise<void> => {
  const paramsParsed = DeleteClientParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  await db.delete(clientsTable).where(eq(clientsTable.id, paramsParsed.data.id));
  res.json({ success: true });
});

export default router;
