import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { headers } from "next/headers";

import { db } from "@/db";
import { files, portalUsers, tenantBranding, tenants } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getRequestTenantHostContext } from "@/lib/tenant-host";
import {
  buildTenantLogoObjectKey,
  deleteFile,
  uploadFile,
} from "@/lib/uploads/r2";
import { requireAdminPortalUser } from "@/modules/core/shared/services/portal-users";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTenantBySlug(slug: string) {
  return (
    (await db.query.tenants.findFirst({
      where: and(eq(tenants.slug, slug), eq(tenants.isActive, true)),
      with: { branding: true },
    })) ?? null
  );
}

export async function getTenantBySlugAnyStatus(slug: string) {
  return (
    (await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      with: { branding: true },
    })) ?? null
  );
}

export async function getCurrentRequestTenant() {
  const hostContext = await getRequestTenantHostContext();
  const matchedTenant = hostContext.tenantSlug
    ? await getTenantBySlugAnyStatus(hostContext.tenantSlug)
    : null;
  const tenant = matchedTenant?.isActive ? matchedTenant : null;
  const inactiveTenant = matchedTenant && !matchedTenant.isActive ? matchedTenant : null;

  return {
    ...hostContext,
    tenant,
    inactiveTenant,
  };
}

export type CurrentRequestTenant = Awaited<
  ReturnType<typeof getCurrentRequestTenant>
>;

export async function getTenantMembershipByAuthUserId(args: {
  authUserId: string;
  tenantId: string;
}) {
  return (
    (await db.query.portalUsers.findFirst({
      where: and(
        eq(portalUsers.authUserId, args.authUserId),
        eq(portalUsers.tenantId, args.tenantId),
        eq(portalUsers.isActive, true),
      ),
      with: {
        authUser: true,
      },
    })) ?? null
  );
}

/**
 * Returns the tenant for the current request host and validates that
 * the signed-in user belongs to it.
 */
export async function getCurrentTenant() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const requestTenant = await getCurrentRequestTenant();
  // Better Auth additionalFields don't automatically extend the inferred
  // session type — cast to access tenantId at runtime.
  const rawSession = session.session as typeof session.session & {
    tenantId?: string | null;
  };
  const sessionTenantId =
    typeof rawSession.tenantId === "string" ? rawSession.tenantId : null;

  if (!requestTenant.tenant) {
    throw new Error("Tenant subdomain required");
  }

  const tenantId = requestTenant.tenant.id;

  if (sessionTenantId && requestTenant.tenant.id !== sessionTenantId) {
    throw new Error("Tenant session mismatch");
  }

  const portalUser = await getTenantMembershipByAuthUserId({
    authUserId: session.user.id,
    tenantId,
  });
  if (!portalUser) {
    throw new Error("Portal user not found for this tenant");
  }

  const tenant = await db.query.tenants.findFirst({
    where: and(eq(tenants.id, portalUser.tenantId), eq(tenants.isActive, true)),
    with: { branding: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}

/**
 * Dedupes `getCurrentTenant` within one React HTTP request when multiple layouts or server components read it.
 */
export const getCurrentTenantCached = cache(getCurrentTenant);

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

// ---------------------------------------------------------------------------
// Branding — logo upload / removal
// ---------------------------------------------------------------------------

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export async function uploadTenantLogo(args: {
  bytes: Buffer;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<CurrentTenant> {
  const current = await requireAdminPortalUser();

  if (!ALLOWED_IMAGE_TYPES.has(args.mimeType)) {
    throw new Error("Logo must be a PNG, JPEG, WebP, or SVG image.");
  }
  if (args.sizeBytes > MAX_LOGO_BYTES) {
    throw new Error("Logo must be 2 MB or smaller.");
  }

  const ext = args.originalFilename.split(".").pop() ?? "";
  const checksum = crypto
    .createHash("sha256")
    .update(args.bytes)
    .digest("hex");

  const tenant = await getCurrentTenant();

  // Archive the old logo file row (if any) and delete the R2 object.
  if (tenant.branding?.logoFileId) {
    const oldFile = await db.query.files.findFirst({
      where: and(
        eq(files.id, tenant.branding.logoFileId),
        eq(files.tenantId, current.tenantId),
      ),
    });
    if (oldFile) {
      await deleteFile(oldFile.objectKey);
      await db
        .update(files)
        .set({ status: "deleted", archivedAt: new Date(), archivedByUserId: current.id })
        .where(eq(files.id, oldFile.id));
    }
  }

  // Insert the new file row.
  const [fileRow] = await db
    .insert(files)
    .values({
      tenantId: current.tenantId,
      category: "tenant_branding",
      storageProvider: "r2",
      bucket: process.env.R2_BUCKET_NAME ?? "erp-r2",
      originalFilename: args.originalFilename,
      mimeType: args.mimeType,
      extension: ext,
      sizeBytes: args.sizeBytes,
      checksumSha256: checksum,
      uploadedByUserId: current.id,
      objectKey: "pending", // filled in after we have the ID
    })
    .returning({ id: files.id });

  if (!fileRow) throw new Error("Failed to create file record.");

  const objectKey = buildTenantLogoObjectKey({
    tenantId: current.tenantId,
    fileId: fileRow.id,
    extension: ext,
  });

  // Upload bytes to R2.
  await uploadFile({
    objectKey,
    body: args.bytes,
    contentType: args.mimeType,
    contentLength: args.sizeBytes,
  });

  // Persist the real object key.
  await db
    .update(files)
    .set({ objectKey })
    .where(eq(files.id, fileRow.id));

  // Upsert the branding row.
  await db
    .insert(tenantBranding)
    .values({
      tenantId: current.tenantId,
      logoFileId: fileRow.id,
      createdByUserId: current.id,
      updatedByUserId: current.id,
    })
    .onConflictDoUpdate({
      target: tenantBranding.tenantId,
      set: {
        logoFileId: fileRow.id,
        updatedByUserId: current.id,
        updatedAt: new Date(),
      },
    });

  return getCurrentTenant();
}

export async function removeTenantLogo(): Promise<CurrentTenant> {
  const current = await requireAdminPortalUser();
  const tenant = await getCurrentTenant();

  if (!tenant.branding?.logoFileId) {
    return tenant;
  }

  const oldFile = await db.query.files.findFirst({
    where: and(
      eq(files.id, tenant.branding.logoFileId),
      eq(files.tenantId, current.tenantId),
    ),
  });

  if (oldFile) {
    await deleteFile(oldFile.objectKey);
    await db
      .update(files)
      .set({ status: "deleted", archivedAt: new Date(), archivedByUserId: current.id })
      .where(eq(files.id, oldFile.id));
  }

  await db
    .update(tenantBranding)
    .set({ logoFileId: null, updatedByUserId: current.id, updatedAt: new Date() })
    .where(eq(tenantBranding.tenantId, current.tenantId));

  return getCurrentTenant();
}

/**
 * Returns the signed R2 URL for the tenant's current logo, or null if none.
 * Use this in server components / API routes. The URL is valid for 1 hour.
 */
export async function getTenantLogoUrl(tenant: CurrentTenant): Promise<string | null> {
  if (!tenant.branding?.logoFileId) return null;

  const file = await db.query.files.findFirst({
    where: and(
      eq(files.id, tenant.branding.logoFileId),
      eq(files.tenantId, tenant.id),
    ),
  });
  if (!file || file.status === "deleted") return null;

  const { getSignedDownloadUrl } = await import("@/lib/uploads/r2");
  return getSignedDownloadUrl(file.objectKey);
}

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
