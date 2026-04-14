import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { animalsTable } from "./animals";
import { farmsTable } from "./farms";

export const animalLifecycleEventsTable = pgTable("animal_lifecycle_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  animalId: uuid("animal_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  farmId: uuid("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  fromStage: text("from_stage"),
  toStage: text("to_stage"),
  eventType: text("event_type").notNull(),
  eventAt: timestamp("event_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_lifecycle_events_animal").on(table.animalId),
  index("idx_lifecycle_events_farm").on(table.farmId),
]);

export type AnimalLifecycleEvent = typeof animalLifecycleEventsTable.$inferSelect;
