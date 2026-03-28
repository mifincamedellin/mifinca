import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  role: text("role", { enum: ["owner", "worker"] }).default("owner"),
  preferredLanguage: text("preferred_language").default("es"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
