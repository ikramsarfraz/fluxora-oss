CREATE TYPE "public"."sso_protocol" AS ENUM('oidc', 'saml');--> statement-breakpoint
CREATE TYPE "public"."sso_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "tenant_sso_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_id" varchar(128) NOT NULL,
	"protocol" "sso_protocol" NOT NULL,
	"default_role" "user_role" DEFAULT 'sales' NOT NULL,
	"enforce_sso_only" boolean DEFAULT false NOT NULL,
	"display_label" varchar(120),
	"status" "sso_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"oidc_config" text,
	"saml_config" text,
	"user_id" text,
	"provider_id" text NOT NULL,
	"organization_id" text,
	"domain" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sso_provider_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
ALTER TABLE "tenant_sso_settings" ADD CONSTRAINT "tenant_sso_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_provider" ADD CONSTRAINT "sso_provider_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_sso_settings_tenant_unique" ON "tenant_sso_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_sso_settings_provider_unique" ON "tenant_sso_settings" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "sso_provider_userId_idx" ON "sso_provider" USING btree ("user_id");