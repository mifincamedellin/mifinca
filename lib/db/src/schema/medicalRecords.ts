import { pgTable, uuid, text, decimal, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { animalsTable } from "./animals";
import { profilesTable } from "./profiles";

export const medicalRecordsTable = pgTable("medical_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  animalId: uuid("animal_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  recordType: text("record_type", {
    enum: ["vaccination", "treatment", "checkup", "surgery", "deworming", "other"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  vetName: text("vet_name"),
  costCop: decimal("cost_cop"),
  recordDate: date("record_date").notNull().defaultNow(),
  nextDueDate: date("next_due_date"),
  createdBy: uuid("created_by").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertMedicalRecordSchema = createInsertSchema(medicalRecordsTable).omit({
  id: true,
  createdAt: true,
});

export type MedicalRecord = typeof medicalRecordsTable.$inferSelect;
export type InsertMedicalRecord = z.infer<typeof insertMedicalRecordSchema>;
