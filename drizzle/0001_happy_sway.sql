ALTER TABLE "portal_users" ALTER COLUMN "auth_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_users_auth_user_id_idx" ON "portal_users" USING btree ("auth_user_id");