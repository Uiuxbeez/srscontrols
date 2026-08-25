import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNo: integer("po_no").notNull().unique(),
  date: text("date").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  deliveryLocation: text("delivery_location"),
  termsOfDelivery: text("terms_of_delivery"),
  modeOfPayment: text("mode_of_payment"),
  notes: text("notes"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).notNull().default("9"),
  sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).notNull().default("9"),
  cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  roundOff: numeric("round_off", { precision: 10, scale: 2 }).notNull().default("0"),
  netTotal: numeric("net_total", { precision: 12, scale: 2 }).notNull().default("0"),
  amountInWords: text("amount_in_words").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseOrderItemsTable = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  sNo: integer("s_no").notNull(),
  description: text("description").notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0"),
  qty: numeric("qty", { precision: 10, scale: 3 }),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  per: text("per"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItemsTable.$inferSelect;
