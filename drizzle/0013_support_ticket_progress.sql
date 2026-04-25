CREATE TYPE "public"."support_ticket_update_author_type" AS ENUM('platform_user', 'portal_user');
CREATE TYPE "public"."support_ticket_update_visibility" AS ENUM('internal', 'tenant_visible');

ALTER TABLE "support_tickets" ADD COLUMN "assigned_platform_user_id" uuid;

CREATE TABLE "support_ticket_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "author_type" "support_ticket_update_author_type" NOT NULL,
  "author_platform_user_id" uuid,
  "author_portal_user_id" uuid,
  "message" text NOT NULL,
  "visibility" "support_ticket_update_visibility" DEFAULT 'internal' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_platform_user_id_platform_users_id_fk"
  FOREIGN KEY ("assigned_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "support_ticket_updates" ADD CONSTRAINT "support_ticket_updates_ticket_id_support_tickets_id_fk"
  FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "support_ticket_updates" ADD CONSTRAINT "support_ticket_updates_author_platform_user_id_platform_users_id_fk"
  FOREIGN KEY ("author_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "support_ticket_updates" ADD CONSTRAINT "support_ticket_updates_author_portal_user_id_portal_users_id_fk"
  FOREIGN KEY ("author_portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "support_tickets_assigned_platform_user_id_idx" ON "support_tickets" USING btree ("assigned_platform_user_id");
CREATE INDEX "support_ticket_updates_ticket_id_idx" ON "support_ticket_updates" USING btree ("ticket_id");
CREATE INDEX "support_ticket_updates_author_platform_user_id_idx" ON "support_ticket_updates" USING btree ("author_platform_user_id");
CREATE INDEX "support_ticket_updates_author_portal_user_id_idx" ON "support_ticket_updates" USING btree ("author_portal_user_id");
CREATE INDEX "support_ticket_updates_visibility_idx" ON "support_ticket_updates" USING btree ("visibility");
CREATE INDEX "support_ticket_updates_created_at_idx" ON "support_ticket_updates" USING btree ("created_at");
