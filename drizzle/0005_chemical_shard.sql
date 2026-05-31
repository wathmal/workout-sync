CREATE TABLE "calendar_event" (
	"gcal_id" text PRIMARY KEY NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garmin_activity" (
	"garmin_id" text PRIMARY KEY NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"activity_type" text NOT NULL,
	"name" text,
	"duration_s" integer,
	"distance_m" integer,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "calendar_event_start_idx" ON "calendar_event" USING btree ("start");--> statement-breakpoint
CREATE INDEX "garmin_activity_start_time_idx" ON "garmin_activity" USING btree ("start_time");