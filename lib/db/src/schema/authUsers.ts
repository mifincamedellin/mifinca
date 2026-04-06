import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const authUsersTable = pgTable("auth_users", {
  id: uuid("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
