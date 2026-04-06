import { pgTable, uuid, text, date, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { farmsTable } from "./farms";
import { zonesTable } from "./zones";

export const animalsTable = pgTable("animals", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  customTag: text("custom_tag"),
  species: text("species", {
    enum: ["cattle", "chicken", "pig", "goat", "sheep", "horse", "other"],
  }).notNull(),
  breed: text("breed"),
  name: text("name"),
  sex: text("sex", { enum: ["male", "female", "unknown"] }),
  dateOfBirth: date("date_of_birth"),
  status: text("status", {
    enum: ["active", "sold", "deceased", "transferred"],
  }).default("active"),
  motherId: uuid("mother_id"),
  fatherId: uuid("father_id"),
  currentZoneId: uuid("current_zone_id").references(() => zonesTable.id, { onDelete: "set null" }),
  photoUrl: text("photo_url"),
  animalType: text("animal_type"),
  notes: text("notes"),
  purchaseDate: date("purchase_date"),
  purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertAnimalSchema = createInsertSchema(animalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Animal = typeof animalsTable.$inferSelect;
export type InsertAnimal = z.infer<typeof insertAnimalSchema>;
