import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
  integer,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const foodLogSourceEnum = pgEnum("food_log_source", [
  "search",
  "text",
  "photo",
  "manual",
  "barcode",
  "off",
]);

export const foodLogEntry = pgTable(
  "food_log_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
    source: foodLogSourceEnum("source").notNull(),

    name: text("name").notNull(),
    grams: numeric("grams").notNull(),
    kcal: numeric("kcal").notNull(),
    proteinG: numeric("protein_g").notNull(),
    carbsG: numeric("carbs_g").notNull(),
    fatG: numeric("fat_g").notNull(),

    kcalPerG: numeric("kcal_per_g").notNull(),
    proteinPerG: numeric("protein_per_g").notNull(),
    carbsPerG: numeric("carbs_per_g").notNull(),
    fatPerG: numeric("fat_per_g").notNull(),

    fmaFoodId: integer("fma_food_id"),
    fmaSource: text("fma_source"),
    fmaSourceId: text("fma_source_id"),
    confidence: numeric("confidence"),
    warnings: jsonb("warnings"),
    rawResponse: jsonb("raw_response"),

    mealName: text("meal_name"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("food_log_entry_logged_at_idx").on(t.loggedAt),
    index("food_log_entry_batch_id_idx").on(t.batchId),
  ],
);

export const macroTarget = pgTable(
  "macro_target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    kcal: integer("kcal").notNull(),
    proteinG: integer("protein_g").notNull(),
    carbsG: integer("carbs_g").notNull(),
    fatG: integer("fat_g").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("macro_target_start_date_idx").on(t.startDate)],
);

export type FoodLogEntryRow = typeof foodLogEntry.$inferSelect;
export type FoodLogEntryInsert = typeof foodLogEntry.$inferInsert;
export type MacroTargetRow = typeof macroTarget.$inferSelect;
export type MacroTargetInsert = typeof macroTarget.$inferInsert;
