import { pgTable, uuid, text, date, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";
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
  isPregnant: boolean("is_pregnant").notNull().default(false),
  pregnancyStartDate: date("pregnancy_start_date"),
  pregnancyDueDate: date("pregnancy_due_date"),
  deathDate: date("death_date"),
  deathCause: text("death_cause"),

  lifecycleStage: text("lifecycle_stage", {
    enum: ["growing", "can_breed", "in_heat", "pregnant", "nursing"],
  }),
  lifecycleStageStartedAt: timestamp("lifecycle_stage_started_at", { withTimezone: true }),
  lifecycleStageEndsAt: timestamp("lifecycle_stage_ends_at", { withTimezone: true }),
  lifecycleAutoManaged: boolean("lifecycle_auto_managed").notNull().default(true),

  currentWeightKg: numeric("current_weight_kg", { precision: 10, scale: 2 }),
  minimumBreedingAgeDays: integer("minimum_breeding_age_days"),
  minimumBreedingWeightKg: numeric("minimum_breeding_weight_kg", { precision: 10, scale: 2 }),

  heatStartedAt: timestamp("heat_started_at", { withTimezone: true }),
  heatEndsAt: timestamp("heat_ends_at", { withTimezone: true }),
  lastHeatRecordedAt: timestamp("last_heat_recorded_at", { withTimezone: true }),

  pregnancyStartedAt: timestamp("pregnancy_started_at", { withTimezone: true }),
  expectedDeliveryAt: timestamp("expected_delivery_at", { withTimezone: true }),
  pregnancyConfirmedAt: timestamp("pregnancy_confirmed_at", { withTimezone: true }),
  pregnancyCheckDueAt: timestamp("pregnancy_check_due_at", { withTimezone: true }),
  pregnancyCheckCompletedAt: timestamp("pregnancy_check_completed_at", { withTimezone: true }),

  nursingStartedAt: timestamp("nursing_started_at", { withTimezone: true }),
  nursingEndsAt: timestamp("nursing_ends_at", { withTimezone: true }),
  weaningDueAt: timestamp("weaning_due_at", { withTimezone: true }),

  latestOffspringId: uuid("latest_offspring_id"),
  nextLifecycleEventType: text("next_lifecycle_event_type"),
  nextLifecycleEventAt: timestamp("next_lifecycle_event_at", { withTimezone: true }),

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
