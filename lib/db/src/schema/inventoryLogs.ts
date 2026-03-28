import { pgTable, uuid, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { inventoryItemsTable } from "./inventoryItems";
import { animalsTable } from "./animals";
import { profilesTable } from "./profiles";

export const inventoryLogsTable = pgTable("inventory_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => inventoryItemsTable.id, { onDelete: "cascade" }),
  action: text("action", {
    enum: ["added", "used", "adjusted", "expired"],
  }).notNull(),
  quantityChange: decimal("quantity_change").notNull(),
  animalId: uuid("animal_id").references(() => animalsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertInventoryLogSchema = createInsertSchema(inventoryLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InventoryLog = typeof inventoryLogsTable.$inferSelect;
export type InsertInventoryLog = z.infer<typeof insertInventoryLogSchema>;
