import { pgTable, uuid, text, decimal, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";

export const financeTransactionsTable = pgTable("finance_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertFinanceTransactionSchema = createInsertSchema(financeTransactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FinanceTransaction = typeof financeTransactionsTable.$inferSelect;
export type InsertFinanceTransaction = z.infer<typeof insertFinanceTransactionSchema>;
