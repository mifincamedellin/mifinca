import { pgTable, uuid, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const farmsTable = pgTable("farms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  totalHectares: decimal("total_hectares"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertFarmSchema = createInsertSchema(farmsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Farm = typeof farmsTable.$inferSelect;
export type InsertFarm = z.infer<typeof insertFarmSchema>;
