import { pgTable, uuid, text, decimal, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  category: text("category", {
    enum: ["feed", "medicine", "tools", "supplies"],
  }).notNull(),
  name: text("name").notNull(),
  quantity: decimal("quantity").notNull().default("0"),
  unit: text("unit", {
    enum: ["kg", "liters", "units", "bags", "doses", "other"],
  }).notNull(),
  lowStockThreshold: decimal("low_stock_threshold"),
  costPerUnitCop: decimal("cost_per_unit_cop"),
  supplierName: text("supplier_name"),
  supplierContact: text("supplier_contact"),
  expirationDate: date("expiration_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
