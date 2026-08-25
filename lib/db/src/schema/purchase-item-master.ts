import { pgTable, serial, text, timestamp, integer, numeric, unique } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

// Auto-populated whenever a Purchase Order item is saved for a client — lets future POs for
// the same client quickly re-pick items instead of retyping them.
export const purchaseItemMasterTable = pgTable("purchase_item_master", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  per: text("per"),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.clientId, table.description),
]);

export type PurchaseItemMaster = typeof purchaseItemMasterTable.$inferSelect;
