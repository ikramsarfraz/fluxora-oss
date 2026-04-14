import { eq } from "drizzle-orm";

import { db } from "@/db";
import { portalUsers } from "@/db/schema";

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

/** Row shape returned by `createPortalUser()` (for client `import type` only). */
export type PortalUserRecord = Awaited<ReturnType<typeof createPortalUser>>;
