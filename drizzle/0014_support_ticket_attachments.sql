ALTER TYPE "public"."file_category" ADD VALUE IF NOT EXISTS 'support_ticket_attachment';

CREATE TABLE "support_ticket_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "update_id" uuid,
  "uploaded_by_type" "support_ticket_update_author_type" NOT NULL,
  "uploaded_by_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_ticket_id_support_tickets_id_fk"
  FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_update_id_support_ticket_updates_id_fk"
  FOREIGN KEY ("update_id") REFERENCES "public"."support_ticket_updates"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_file_id_files_id_fk"
  FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "support_ticket_attachments_ticket_id_idx" ON "support_ticket_attachments" USING btree ("ticket_id");
CREATE INDEX "support_ticket_attachments_update_id_idx" ON "support_ticket_attachments" USING btree ("update_id");
CREATE INDEX "support_ticket_attachments_file_id_idx" ON "support_ticket_attachments" USING btree ("file_id");
CREATE INDEX "support_ticket_attachments_uploaded_by_idx" ON "support_ticket_attachments" USING btree ("uploaded_by_type", "uploaded_by_id");
