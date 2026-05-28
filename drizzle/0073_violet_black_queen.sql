CREATE TABLE "platform_user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "platform_role" NOT NULL,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by_platform_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_auth_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "platform_user_invitations" ADD CONSTRAINT "platform_user_invitations_invited_by_platform_user_id_platform_users_id_fk" FOREIGN KEY ("invited_by_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_user_invitations" ADD CONSTRAINT "platform_user_invitations_accepted_by_auth_user_id_user_id_fk" FOREIGN KEY ("accepted_by_auth_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_user_invitations_email_idx" ON "platform_user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "platform_user_invitations_token_idx" ON "platform_user_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "platform_user_invitations_status_idx" ON "platform_user_invitations" USING btree ("status");