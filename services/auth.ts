import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { db } from "@/db";
import { userInvitations } from "@/db/schema";
import { resend, emailFrom } from "@/lib/email";
import { InviteUserEmail } from "@/emails/invite-user";
import { getCurrentTenant } from "./tenants";
import { PortalUserRole } from "./portal-users";

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}) {
  const data = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  return data;
}

export async function inviteUser(input: {
  email: string;
  fullName: string;
  role: PortalUserRole;
  invitedByUserId: string;
}) {
  const tenant = await getCurrentTenant();
  const token = randomUUID();
  const expiresAt = addDays(new Date(), 7);

  await db.insert(userInvitations).values({
    tenantId: tenant.id,
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    token,
    invitedByUserId: input.invitedByUserId,
    expiresAt,
  });

  const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${token}`;

  await resend.emails.send({
    from: emailFrom,
    to: input.email,
    subject: "You were invited to Acme Distribution",
    react: InviteUserEmail({
      fullName: input.fullName,
      inviteUrl,
    }),
  });

  return { success: true };
}

/** Row shape returned by `signUp()` (for client `import type` only). */
export type SignUpResponse = Awaited<ReturnType<typeof signUp>>;
