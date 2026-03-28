import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";
import { profilesTable } from "./profiles";

export const activityLogTable = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => profilesTable.id),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({
  id: true,
  createdAt: true,
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
