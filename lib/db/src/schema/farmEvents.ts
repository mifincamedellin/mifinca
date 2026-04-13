import { pgTable, uuid, text, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { animalsTable } from "./animals";
import { medicalRecordsTable } from "./medicalRecords";

export const farmEventsTable = pgTable("farm_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull(),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  descriptionEn: text("description_en"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  allDay: boolean("all_day").notNull().default(true),
  category: text("category", { enum: ["feeding", "health", "harvest", "maintenance", "meeting", "other"] }).default("other"),
  assignedTo: text("assigned_to"),
  color: text("color"),
  animalId: uuid("animal_id").references(() => animalsTable.id, { onDelete: "set null" }),
  medicalRecordId: uuid("medical_record_id").references(() => medicalRecordsTable.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type FarmEvent = typeof farmEventsTable.$inferSelect;
