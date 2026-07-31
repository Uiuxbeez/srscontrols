import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { quotationsTable } from "./quotations";

export const panelsTable = pgTable("panels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  breakdownText: text("breakdown_text").notNull().default(""),
  panelSize: text("panel_size").notNull().default(""),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  defaultQty: integer("default_qty").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationPanelSpecsTable = pgTable("quotation_panel_specs", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id")
    .notNull()
    .references(() => quotationsTable.id, { onDelete: "cascade" }),
  sNo: integer("s_no").notNull(),
  panelName: text("panel_name").notNull(),
  breakdownText: text("breakdown_text").notNull().default(""),
  panelSize: text("panel_size").notNull().default(""),
});

export type Panel = typeof panelsTable.$inferSelect;
export type QuotationPanelSpec = typeof quotationPanelSpecsTable.$inferSelect;
