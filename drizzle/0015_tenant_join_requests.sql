CREATE TYPE "public"."tenant_join_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "tenant_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"auth_user_id" text,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"requested_role" "public"."user_role" DEFAULT 'sales' NOT NULL,
	"status" "public"."tenant_join_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "tenant_join_requests" ADD CONSTRAINT "tenant_join_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_join_requests" ADD CONSTRAINT "tenant_join_requests_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_join_requests" ADD CONSTRAINT "tenant_join_requests_reviewed_by_user_id_portal_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_join_requests_tenant_id_idx" ON "tenant_join_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_join_requests_status_idx" ON "tenant_join_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_join_requests_requested_at_idx" ON "tenant_join_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "tenant_join_requests_auth_user_id_idx" ON "tenant_join_requests" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "tenant_join_requests_reviewed_by_user_id_idx" ON "tenant_join_requests" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "tenant_join_requests_email_idx" ON "tenant_join_requests" USING btree ("email");--> statement-breakpoint
