CREATE TABLE IF NOT EXISTS "tenant_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"feature" varchar(128) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "first_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "full_name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "tenant_features" ADD CONSTRAINT "tenant_features_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_features_tenant_feature_unique" ON "tenant_features" USING btree ("tenant_id","feature");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_features_tenant_idx" ON "tenant_features" USING btree ("tenant_id");
