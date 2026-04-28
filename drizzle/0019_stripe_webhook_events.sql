CREATE TYPE "public"."stripe_webhook_processing_status" AS ENUM('processing', 'succeeded', 'failed');
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" varchar(255) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"processing_status" "stripe_webhook_processing_status" DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_unique" ON "stripe_webhook_events" USING btree ("stripe_event_id");
--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_processing_status_idx" ON "stripe_webhook_events" USING btree ("processing_status");
