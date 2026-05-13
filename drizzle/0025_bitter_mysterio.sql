CREATE TYPE "public"."expense_recurrence_interval" AS ENUM('none', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_interval" "expense_recurrence_interval" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_start_date" date;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_end_date" date;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_next_due_date" date;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_parent_id" uuid;--> statement-breakpoint
CREATE INDEX "expenses_recurrence_next_due_idx" ON "expenses" USING btree ("tenant_id","recurrence_next_due_date");--> statement-breakpoint
CREATE INDEX "expenses_recurrence_parent_idx" ON "expenses" USING btree ("recurrence_parent_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurrence_end_after_start" CHECK ("expenses"."recurrence_end_date" IS NULL OR "expenses"."recurrence_start_date" IS NULL OR "expenses"."recurrence_end_date" >= "expenses"."recurrence_start_date");