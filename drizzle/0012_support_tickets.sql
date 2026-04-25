CREATE TYPE "public"."support_ticket_issue_type" AS ENUM('bug', 'question', 'feature_request', 'workflow_issue');
CREATE TYPE "public"."support_ticket_priority" AS ENUM('low', 'medium', 'high');
CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'in_progress', 'resolved');

CREATE TABLE "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "portal_user_id" uuid,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "issue_type" "support_ticket_issue_type" NOT NULL,
  "priority" "support_ticket_priority" DEFAULT 'medium' NOT NULL,
  "subject" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "page_url" text,
  "status" "support_ticket_status" DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_portal_user_id_portal_users_id_fk"
  FOREIGN KEY ("portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "support_tickets_tenant_id_idx" ON "support_tickets" USING btree ("tenant_id");
CREATE INDEX "support_tickets_portal_user_id_idx" ON "support_tickets" USING btree ("portal_user_id");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets" USING btree ("priority");
CREATE INDEX "support_tickets_issue_type_idx" ON "support_tickets" USING btree ("issue_type");
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets" USING btree ("created_at");
