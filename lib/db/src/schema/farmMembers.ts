import { pgTable, uuid, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";
import { profilesTable } from "./profiles";

export type FarmPermissions = {
  can_view_animals: boolean;
  can_add_animals: boolean;
  can_edit_animals: boolean;
  can_remove_animals: boolean;
  can_view_inventory: boolean;
  can_add_inventory: boolean;
  can_edit_inventory: boolean;
  can_remove_inventory: boolean;
  can_view_finances: boolean;
  can_add_finances: boolean;
  can_edit_finances: boolean;
  can_remove_finances: boolean;
  can_view_contacts: boolean;
  can_add_contacts: boolean;
  can_edit_contacts: boolean;
  can_remove_contacts: boolean;
  can_view_employees: boolean;
  can_add_employees: boolean;
  can_edit_employees: boolean;
  can_remove_employees: boolean;
  can_view_calendar: boolean;
  can_add_calendar: boolean;
  can_edit_calendar: boolean;
  can_remove_calendar: boolean;
};

export const DEFAULT_OWNER_PERMISSIONS: FarmPermissions = {
  can_view_animals: true, can_add_animals: true, can_edit_animals: true, can_remove_animals: true,
  can_view_inventory: true, can_add_inventory: true, can_edit_inventory: true, can_remove_inventory: true,
  can_view_finances: true, can_add_finances: true, can_edit_finances: true, can_remove_finances: true,
  can_view_contacts: true, can_add_contacts: true, can_edit_contacts: true, can_remove_contacts: true,
  can_view_employees: true, can_add_employees: true, can_edit_employees: true, can_remove_employees: true,
  can_view_calendar: true, can_add_calendar: true, can_edit_calendar: true, can_remove_calendar: true,
};

export const DEFAULT_WORKER_PERMISSIONS: FarmPermissions = {
  can_view_animals: true, can_add_animals: false, can_edit_animals: false, can_remove_animals: false,
  can_view_inventory: true, can_add_inventory: false, can_edit_inventory: false, can_remove_inventory: false,
  can_view_finances: true, can_add_finances: false, can_edit_finances: false, can_remove_finances: false,
  can_view_contacts: true, can_add_contacts: false, can_edit_contacts: false, can_remove_contacts: false,
  can_view_employees: true, can_add_employees: false, can_edit_employees: false, can_remove_employees: false,
  can_view_calendar: true, can_add_calendar: false, can_edit_calendar: false, can_remove_calendar: false,
};

export const farmMembersTable = pgTable("farm_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "worker"] }).default("worker"),
  permissions: jsonb("permissions").$type<FarmPermissions>().default(DEFAULT_WORKER_PERMISSIONS),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [unique().on(t.farmId, t.userId)]);

export const insertFarmMemberSchema = createInsertSchema(farmMembersTable).omit({
  id: true,
  createdAt: true,
});

export type FarmMember = typeof farmMembersTable.$inferSelect;
export type InsertFarmMember = z.infer<typeof insertFarmMemberSchema>;
