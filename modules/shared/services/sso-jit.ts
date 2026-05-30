import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { portalUsers, tenantSsoSettings, userRoleEnum } from "@/db/schema";

export type PortalRole = (typeof userRoleEnum.enumValues)[number];

/**
 * Active SSO settings for a tenant, or null when none / disabled.
 *
 * Kept dependency-light (only `db` + schema) so it is safe to import from
 * `lib/auth.ts` without creating an import cycle through `portal-users.ts`
 * (which imports `lib/auth`).
 */
export async function getActiveTenantSsoSettings(tenantId: string) {
  const row = await db.query.tenantSsoSettings.findFirst({
    where: and(
      eq(tenantSsoSettings.tenantId, tenantId),
      eq(tenantSsoSettings.status, "active"),
    ),
  });
  return row ?? null;
}

/**
 * Idempotently provision an SSO-authenticated user as a portal member of a
 * tenant (JIT). Returns the existing row if one is already present. No seat-limit
 * check: SSO is enterprise-only, where `maxPortalUsers` is unlimited.
 *
 * MUST stay free of `lib/auth` imports — it is called from the Better Auth
 * `session.create.before` hook.
 */
export async function jitProvisionSsoMembership(input: {
  tenantId: string;
  authUserId: string;
  email: string;
  fullName: string;
  role: PortalRole;
}) {
  const existing = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.authUserId, input.authUserId),
      eq(portalUsers.tenantId, input.tenantId),
    ),
  });
  if (existing) return existing;

  const [row] = await db
    .insert(portalUsers)
    .values({
      tenantId: input.tenantId,
      authUserId: input.authUserId,
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      isActive: true,
    })
    .returning();

  return row ?? null;
}
