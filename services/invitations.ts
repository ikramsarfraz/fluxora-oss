import { isAPIError } from "better-auth/api";
import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { userInvitations } from "@/db/schema";
import { signUp } from "@/services/auth";
import {
  createPortalUser,
  requireAdminPortalUser,
  type PortalUserRole,
} from "@/services/portal-users";

export type InvitationPreviewResult =
  | {
      ok: true;
      fullName: string;
      email: string;
      role: PortalUserRole;
    }
  | { ok: false; reason: "not_found" | "used" | "expired" };

export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreviewResult> {
  const [row] = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.token, token))
    .limit(1);

  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (row.status !== "pending") {
    return { ok: false, reason: "used" };
  }
  if (row.expiresAt < new Date()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
  };
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
}) {
  const [invitation] = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.token, input.token))
    .limit(1);

  if (!invitation) {
    throw new Error("Invitation not found");
  }
  if (invitation.status !== "pending") {
    throw new Error("This invitation is no longer valid");
  }
  if (invitation.expiresAt < new Date()) {
    throw new Error("This invitation has expired");
  }

  try {
    const signup = await signUp({
      name: invitation.fullName,
      email: invitation.email,
      password: input.password,
    });
    if (!signup?.user?.id) {
      throw new Error("Sign up did not return a user id.");
    }
    await createPortalUser({
      tenantId: invitation.tenantId,
      authUserId: signup.user.id,
      fullName: invitation.fullName,
      email: invitation.email,
      role: invitation.role,
    });
  } catch (e) {
    if (isAPIError(e)) {
      throw new Error(e.message || "Could not create account.");
    }
    throw e;
  }

  await db
    .update(userInvitations)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
    })
    .where(eq(userInvitations.id, invitation.id));

  return { success: true as const };
}

/** Pending, non-expired invitations (admin-only). */
export async function listPendingInvitationsForAdmin() {
  await requireAdminPortalUser();
  return await db
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.status, "pending"),
        gt(userInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(userInvitations.createdAt));
}

export type PendingInvitationListItem = Awaited<
  ReturnType<typeof listPendingInvitationsForAdmin>
>[number];
