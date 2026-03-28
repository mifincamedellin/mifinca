import { pgTable, uuid, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";
import { profilesTable } from "./profiles";

export const farmMembersTable = pgTable("farm_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "worker"] }).default("worker"),
  permissions: jsonb("permissions").$type<{
    can_edit: boolean;
    can_add_animals: boolean;
    can_log_inventory: boolean;
  }>().default({ can_edit: false, can_add_animals: true, can_log_inventory: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [unique().on(t.farmId, t.userId)]);

export const insertFarmMemberSchema = createInsertSchema(farmMembersTable).omit({
  id: true,
  createdAt: true,
});

export type FarmMember = typeof farmMembersTable.$inferSelect;
export type InsertFarmMember = z.infer<typeof insertFarmMemberSchema>;
