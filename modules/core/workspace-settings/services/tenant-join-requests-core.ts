import { and, asc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { user as authUserTable } from "@/db/auth-schema";
import { portalUsers, tenantJoinRequests } from "@/db/schema";

export type TenantJoinRequestedRole = "sales" | "warehouse";

export function normalizeTenantJoinRequestEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findAuthUserIdByEmail(email: string) {
  const normalizedEmail = normalizeTenantJoinRequestEmail(email);
  const [authUser] = await db
    .select({ id: authUserTable.id })
    .from(authUserTable)
    .where(sql`lower(${authUserTable.email}) = ${normalizedEmail}`)
    .limit(1);

  return authUser?.id ?? null;
}

export async function provisionPortalMembershipFromJoinRequest(input: {
  tenantId: string;
  authUserId: string;
  email: string;
  fullName: string;
  requestedRole: TenantJoinRequestedRole;
}) {
  const normalizedEmail = normalizeTenantJoinRequestEmail(input.email);
  const [existingByAuthUser] = await db
    .select()
    .from(portalUsers)
    .where(
      and(
        eq(portalUsers.tenantId, input.tenantId),
        eq(portalUsers.authUserId, input.authUserId),
      ),
    )
    .limit(1);

  const [existingByEmail] = existingByAuthUser
    ? [null]
    : await db
        .select()
        .from(portalUsers)
        .where(
          and(
            eq(portalUsers.tenantId, input.tenantId),
            sql`lower(${portalUsers.email}) = ${normalizedEmail}`,
          ),
        )
        .limit(1);

  const existing = existingByAuthUser ?? existingByEmail;

  if (existing) {
    const [updated] = await db
      .update(portalUsers)
      .set({
        authUserId: input.authUserId,
        email: normalizedEmail,
        fullName: input.fullName.trim(),
        role: input.requestedRole,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(portalUsers.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to activate tenant membership.");
    }

    return updated;
  }

  const [created] = await db
    .insert(portalUsers)
    .values({
      tenantId: input.tenantId,
      authUserId: input.authUserId,
      email: normalizedEmail,
      fullName: input.fullName.trim(),
      role: input.requestedRole,
      isActive: true,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create tenant membership.");
  }

  return created;
}

export async function claimApprovedTenantJoinRequestForSession(input: {
  tenantId: string;
  authUserId: string;
  email: string;
  fallbackFullName: string;
}) {
  const normalizedEmail = normalizeTenantJoinRequestEmail(input.email);
  const approvedRequest = await db.query.tenantJoinRequests.findFirst({
    where: and(
      eq(tenantJoinRequests.tenantId, input.tenantId),
      eq(tenantJoinRequests.status, "approved"),
      or(
        eq(tenantJoinRequests.authUserId, input.authUserId),
        sql`lower(${tenantJoinRequests.email}) = ${normalizedEmail}`,
      ),
    ),
    orderBy: [asc(tenantJoinRequests.requestedAt)],
  });

  if (!approvedRequest) {
    return null;
  }

  const membership = await provisionPortalMembershipFromJoinRequest({
    tenantId: input.tenantId,
    authUserId: input.authUserId,
    email: approvedRequest.email,
    fullName: approvedRequest.fullName || input.fallbackFullName,
    requestedRole: approvedRequest.requestedRole as TenantJoinRequestedRole,
  });

  if (approvedRequest.authUserId !== input.authUserId) {
    await db
      .update(tenantJoinRequests)
      .set({
        authUserId: input.authUserId,
        updatedAt: new Date(),
      })
      .where(eq(tenantJoinRequests.id, approvedRequest.id));
  }

  return membership;
}
