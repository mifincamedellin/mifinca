import { pgTable, uuid, decimal, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { animalsTable } from "./animals";
import { profilesTable } from "./profiles";

export const weightRecordsTable = pgTable("weight_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  animalId: uuid("animal_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  weightKg: decimal("weight_kg").notNull(),
  recordedAt: date("recorded_at").notNull().defaultNow(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertWeightRecordSchema = createInsertSchema(weightRecordsTable).omit({
  id: true,
  createdAt: true,
});

export type WeightRecord = typeof weightRecordsTable.$inferSelect;
export type InsertWeightRecord = z.infer<typeof insertWeightRecordSchema>;
