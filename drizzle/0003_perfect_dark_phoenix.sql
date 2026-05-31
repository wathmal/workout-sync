CREATE TABLE "race_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"event_target" text,
	"location" text,
	"note" text,
	"result_time" text,
	"result_placement" text,
	"result_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "race_event_date_idx" ON "race_event" USING btree ("date");