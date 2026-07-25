import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNo: text("quotation_no").notNull(),
  date: text("date").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  subject: text("subject"),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  afterDiscountTotal: numeric("after_discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  roundOff: numeric("round_off", { precision: 10, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  amountInWords: text("amount_in_words").notNull().default(""),
  termsAdvance: text("terms_advance"),
  termsDelivery: text("terms_delivery"),
  termsTransport: text("terms_transport"),
  termsTax: text("terms_tax"),
  termsValidity: text("terms_validity"),
  termsWarranty: text("terms_warranty"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationItemsTable = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id")
    .notNull()
    .references(() => quotationsTable.id, { onDelete: "cascade" }),
  sNo: integer("s_no").notNull(),
  description: text("description").notNull(),
  qty: numeric("qty", { precision: 10, scale: 3 }),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export type Quotation = typeof quotationsTable.$inferSelect;
export type QuotationItem = typeof quotationItemsTable.$inferSelect;
