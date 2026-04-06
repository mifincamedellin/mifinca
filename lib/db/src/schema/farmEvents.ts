import { pgTable, uuid, text, date, boolean, timestamp } from "drizzle-orm/pg-core";

export const farmEventsTable = pgTable("farm_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  allDay: boolean("all_day").notNull().default(true),
  category: text("category", { enum: ["feeding", "health", "harvest", "maintenance", "meeting", "other"] }).default("other"),
  assignedTo: text("assigned_to"),
  color: text("color"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type FarmEvent = typeof farmEventsTable.$inferSelect;
