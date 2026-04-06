import { pgTable, uuid, text, date, timestamp, numeric } from "drizzle-orm/pg-core";
import { animalsTable } from "./animals";

export const milkRecordsTable = pgTable("milk_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  animalId: uuid("animal_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  recordedAt: date("recorded_at").notNull().defaultNow(),
  amountLiters: numeric("amount_liters", { precision: 8, scale: 2 }).notNull(),
  session: text("session", { enum: ["morning", "afternoon", "evening", "full_day"] }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type MilkRecord = typeof milkRecordsTable.$inferSelect;
