import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subCategoriesTable = pgTable("sub_categories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  subCategoryId: integer("sub_category_id")
    .notNull()
    .references(() => subCategoriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  catNo: text("cat_no").default(""),
  price: numeric("price", { precision: 12, scale: 2 }),
  packQty: integer("pack_qty"),
  specifications: text("specifications").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Category = typeof categoriesTable.$inferSelect;
export type SubCategory = typeof subCategoriesTable.$inferSelect;
export type Item = typeof itemsTable.$inferSelect;
