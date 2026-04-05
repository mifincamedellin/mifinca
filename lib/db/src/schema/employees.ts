import { pgTable, uuid, text, date, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";

export const employeesTable = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  startDate: date("start_date"),
  monthlySalary: decimal("monthly_salary", { precision: 12, scale: 2 }).default("0"),
  bankName: text("bank_name").default("Bancolombia"),
  bankAccount: text("bank_account"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  // Colombian labour benefits
  pension: decimal("pension", { precision: 12, scale: 2 }).default("0"),
  salud: decimal("salud", { precision: 12, scale: 2 }).default("0"),
  arl: decimal("arl", { precision: 12, scale: 2 }).default("0"),
  primas: decimal("primas", { precision: 12, scale: 2 }).default("0"),
  cesantias: decimal("cesantias", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
