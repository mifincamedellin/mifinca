import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";

export const farmInvitationsTable = pgTable("farm_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  invitedByUserId: uuid("invited_by_user_id").notNull(),
  role: text("role", { enum: ["owner", "worker"] }).default("worker"),
  status: text("status", { enum: ["pending", "accepted"] }).default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [unique().on(t.farmId, t.invitedEmail)]);

export const insertFarmInvitationSchema = createInsertSchema(farmInvitationsTable).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type FarmInvitation = typeof farmInvitationsTable.$inferSelect;
export type InsertFarmInvitation = z.infer<typeof insertFarmInvitationSchema>;
