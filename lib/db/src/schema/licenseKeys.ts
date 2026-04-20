import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const licenseKeysTable = pgTable("license_keys", {
  id:         uuid("id").primaryKey().defaultRandom(),
  key:        text("key").notNull().unique(),
  userId:     uuid("user_id").references(() => profilesTable.id, { onDelete: "set null" }),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt:  timestamp("revoked_at", { withTimezone: true }),
  notes:      text("notes"),
  createdBy:  text("created_by"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertLicenseKeySchema = createInsertSchema(licenseKeysTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LicenseKey = typeof licenseKeysTable.$inferSelect;
export type InsertLicenseKey = z.infer<typeof insertLicenseKeySchema>;
