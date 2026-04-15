import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { portalUsers } from "@/db/schema";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type PortalUserRole = "admin" | "sales" | "warehouse" | "accounting";

/** First self-serve signup gets admin; adjust if you add invites later. */
const DEFAULT_SIGNUP_ROLE: PortalUserRole = "admin";

/**
 * Creates ERP `portal_users` row for the signed-in Better Auth user (idempotent).
 * Call after `authClient.signUp.email` succeeds so cookies are present.
 */
export async function createPortalUser(input: {
  authUserId: string;
  fullName: string;
  email: string;
  role?: PortalUserRole;
}) {
  const existing = await db.query.portalUsers.findFirst({
    where: eq(portalUsers.authUserId, input.authUserId),
  });
  if (existing) return existing;

  const [row] = await db
    .insert(portalUsers)
    .values({
      authUserId: input.authUserId,
      fullName: input.fullName,
      email: input.email,
      role: input.role ?? DEFAULT_SIGNUP_ROLE,
      isActive: true,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create portal user");
  }
  return row;
}

/**
 * Gets all portal users.
 */
export async function getUsers() {
  // Only get users if current user is an admin
  // use session storage to get the current user
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return await db.query.portalUsers.findMany();
}

/**
 * Gets a portal user by id.
 */
export async function getUserById(id: number) {
  const user = await db.query.portalUsers.findFirst({
    where: eq(portalUsers.id, id),
    with: {
      authUser: true,
    },
  });
  return user;
}

/** Row shape returned by `createPortalUser()` (for client `import type` only). */
export type PortalUserRecord = Awaited<ReturnType<typeof createPortalUser>>;

/** Single user with Better Auth row (from `getUserById`). */
export type PortalUserDetail = NonNullable<
  Awaited<ReturnType<typeof getUserById>>
>;

/**
 * Gets a portal user by auth user id.
 */
export async function getUserByAuthUserId(authUserId: string) {
  const user = await db.query.portalUsers.findFirst({
    where: eq(portalUsers.authUserId, authUserId),
    with: {
      authUser: true,
    },
  });
  return user;
}

/**
 * Current session user must be an admin (`portal_users.role === "admin"`).
 */
export async function requireAdminPortalUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const current = await getUserByAuthUserId(session.user.id);
  if (!current || current.role !== "admin") {
    throw new Error("Forbidden");
  }
  return current;
}

/**
 * Sets `portal_users.is_active`. Admins cannot deactivate themselves.
 */
export async function setPortalUserActiveByAdmin(
  targetUserId: number,
  isActive: boolean,
): Promise<PortalUserDetail> {
  const current = await requireAdminPortalUser();
  if (current.id === targetUserId && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  const target = await getUserById(targetUserId);
  if (!target) {
    throw new Error("User not found");
  }

  await db
    .update(portalUsers)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(portalUsers.id, targetUserId));

  const updated = await getUserById(targetUserId);
  if (!updated) {
    throw new Error("Failed to load user after update");
  }
  return updated;
}

/**
 * Sends Better Auth password-reset email to the user&apos;s sign-in address.
 */
export async function sendPasswordResetForUserByAdmin(
  targetUserId: number,
): Promise<{ success: true }> {
  await requireAdminPortalUser();

  const target = await getUserById(targetUserId);
  if (!target) {
    throw new Error("User not found");
  }

  const email = target.authUser?.email ?? target.email;

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: "/reset-password",
      },
    });
  } catch (e) {
    if (isAPIError(e)) {
      throw new Error(e.message || "Failed to send password reset email.");
    }
    throw e;
  }

  return { success: true };
}
