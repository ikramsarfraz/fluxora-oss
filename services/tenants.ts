import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getUserByAuthUserId, requireAdminPortalUser } from "./portal-users";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Returns the tenant that belongs to the currently signed-in portal user.
 * Throws if there is no active session or the user has no tenant row.
 */
export async function getCurrentTenant() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const portalUser = await getUserByAuthUserId(session.user.id);
  if (!portalUser) {
    throw new Error("Portal user not found");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, portalUser.tenantId),
    with: { branding: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}

export type CurrentTenant = Awaited<ReturnType<typeof getCurrentTenant>>;

/**
 * Returns a tenant by its primary key. No auth check — call only from
 * server contexts that have already verified the caller's access.
 */
export async function getTenantById(tenantId: string) {
  return (
    (await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: { branding: true },
    })) ?? null
  );
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type UpdateTenantInput = {
  name?: string;
  slug?: string;
};

/**
 * Allows an owner or admin to update their own tenant's profile fields.
 * The caller must be an admin/owner of the tenant being updated.
 */
export async function updateCurrentTenant(
  input: UpdateTenantInput,
): Promise<CurrentTenant> {
  const current = await requireAdminPortalUser();

  if (input.slug) {
    const conflict = await db.query.tenants.findFirst({
      where: eq(tenants.slug, input.slug),
    });
    if (conflict && conflict.id !== current.tenantId) {
      throw new Error("That slug is already taken.");
    }
  }

  await db
    .update(tenants)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, current.tenantId));

  return getCurrentTenant();
}
