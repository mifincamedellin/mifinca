import { pgTable, uuid, text, integer, decimal, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";

export const zonesTable = pgTable("zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  zoneType: text("zone_type", {
    enum: ["grazing", "feeding", "water", "waste", "crops", "shelter", "storage", "other"],
  }),
  color: text("color").default("#4A6741"),
  capacity: integer("capacity"),
  areaHectares: decimal("area_hectares"),
  geometry: jsonb("geometry"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertZoneSchema = createInsertSchema(zonesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Zone = typeof zonesTable.$inferSelect;
export type InsertZone = z.infer<typeof insertZoneSchema>;
