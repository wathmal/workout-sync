CREATE TABLE "favorite_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature" text NOT NULL,
	"meal_name" text,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_meal_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE INDEX "favorite_meal_created_at_idx" ON "favorite_meal" USING btree ("created_at");