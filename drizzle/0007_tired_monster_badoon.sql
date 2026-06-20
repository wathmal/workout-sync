ALTER TYPE "public"."food_log_source" ADD VALUE 'label';--> statement-breakpoint
ALTER TABLE "food_log_entry" ALTER COLUMN "grams" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entry" ALTER COLUMN "kcal_per_g" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entry" ALTER COLUMN "protein_per_g" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entry" ALTER COLUMN "carbs_per_g" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entry" ALTER COLUMN "fat_per_g" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entry" ADD COLUMN "unit" text DEFAULT 'g' NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entry" ADD COLUMN "servings" numeric;--> statement-breakpoint
ALTER TABLE "food_log_entry" ADD COLUMN "serving_label" text;