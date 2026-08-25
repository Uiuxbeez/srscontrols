import { pgTable, serial, text, timestamp, integer, numeric, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { suppliersTable } from "./suppliers";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNo: integer("invoice_no").notNull(),
  // "invoice" or "proforma" — same document shape, numbered in separate sequences (see the
  // composite unique constraint below), and a Proforma additionally carries a Supplier block.
  documentType: text("document_type").notNull().default("invoice"),
  date: text("date").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  workSite: text("work_site"),
  deliveryNote: text("delivery_note"),
  modeOfPayment: text("mode_of_payment"),
  suppliersRef: text("suppliers_ref"),
  othersRef: text("others_ref"),
  buyersOrderNo: text("buyers_order_no"),
  buyersOrderDate: text("buyers_order_date"),
  despatchDocNo: text("despatch_doc_no"),
  despatchDocDate: text("despatch_doc_date"),
  despatchedThrough: text("despatched_through"),
  destination: text("destination"),
  termsOfDelivery: text("terms_of_delivery"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).notNull().default("9"),
  sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).notNull().default("9"),
  cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  roundOff: numeric("round_off", { precision: 10, scale: 2 }).notNull().default("0"),
  netTotal: numeric("net_total", { precision: 12, scale: 2 }).notNull().default("0"),
  amountInWords: text("amount_in_words").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.documentType, table.invoiceNo),
]);

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  sNo: integer("s_no").notNull(),
  description: text("description").notNull(),
  hsnSac: text("hsn_sac"),
  qty: numeric("qty", { precision: 10, scale: 3 }),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  per: text("per"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true });

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
