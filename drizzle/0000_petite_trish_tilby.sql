CREATE TYPE "public"."food_log_source" AS ENUM('search', 'text', 'photo', 'manual');--> statement-breakpoint
CREATE TABLE "food_log_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"logged_at" timestamp with time zone NOT NULL,
	"source" "food_log_source" NOT NULL,
	"name" text NOT NULL,
	"grams" numeric NOT NULL,
	"kcal" numeric NOT NULL,
	"protein_g" numeric NOT NULL,
	"carbs_g" numeric NOT NULL,
	"fat_g" numeric NOT NULL,
	"kcal_per_g" numeric NOT NULL,
	"protein_per_g" numeric NOT NULL,
	"carbs_per_g" numeric NOT NULL,
	"fat_per_g" numeric NOT NULL,
	"fma_food_id" integer,
	"fma_source" text,
	"fma_source_id" text,
	"confidence" numeric,
	"warnings" jsonb,
	"raw_response" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "macro_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"kcal" integer NOT NULL,
	"protein_g" integer NOT NULL,
	"carbs_g" integer NOT NULL,
	"fat_g" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "food_log_entry_logged_at_idx" ON "food_log_entry" USING btree ("logged_at");--> statement-breakpoint
CREATE INDEX "food_log_entry_batch_id_idx" ON "food_log_entry" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "macro_target_start_date_idx" ON "macro_target" USING btree ("start_date");