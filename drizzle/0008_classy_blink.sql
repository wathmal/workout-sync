CREATE TABLE "daily_fitness_metric" (
	"date" date PRIMARY KEY NOT NULL,
	"vo2max_running" real,
	"vo2max_computed_date" date,
	"uth_vo2max" real,
	"race_pred_5k_s" integer,
	"race_pred_10k_s" integer,
	"race_pred_hm_s" integer,
	"race_pred_m_s" integer,
	"training_status_code" integer,
	"fitness_trend_code" integer,
	"weekly_load" integer,
	"resting_hr" integer,
	"fitness_index" real,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hyrox_projection" (
	"date" date PRIMARY KEY NOT NULL,
	"division" text NOT NULL,
	"predicted_total_s" integer NOT NULL,
	"range_low_s" integer,
	"range_high_s" integer,
	"run_pace_s_per_km" integer,
	"segments" jsonb,
	"basis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hyrox_station_benchmark" (
	"id" serial PRIMARY KEY NOT NULL,
	"station" text NOT NULL,
	"time_s" integer NOT NULL,
	"weight_kg" integer,
	"distance_m" integer,
	"race_position" integer,
	"source_fit" text,
	"measured_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE INDEX "daily_fitness_metric_date_idx" ON "daily_fitness_metric" USING btree ("date");