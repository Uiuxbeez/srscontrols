import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { quotationsTable } from "./quotations";

export const techSpecItemsTable = pgTable("tech_spec_items", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull().unique(),
  defaultSpec: text("default_spec").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationTechSpecsTable = pgTable("quotation_tech_specs", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id")
    .notNull()
    .references(() => quotationsTable.id, { onDelete: "cascade" }),
  sNo: integer("s_no").notNull(),
  itemName: text("item_name").notNull(),
  spec: text("spec").notNull().default(""),
});

export type TechSpecItem = typeof techSpecItemsTable.$inferSelect;
export type QuotationTechSpec = typeof quotationTechSpecsTable.$inferSelect;
