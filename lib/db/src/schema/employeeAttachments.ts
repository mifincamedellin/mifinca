import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { farmsTable } from "./farms";

export const employeeAttachmentsTable = pgTable("employee_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type EmployeeAttachment = typeof employeeAttachmentsTable.$inferSelect;
