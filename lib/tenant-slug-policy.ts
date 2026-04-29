/** Client-safe slug rules — no Next.js server imports. Imported by onboarding forms and `@/lib/tenant-host`. */

const RESERVED_TENANT_SLUGS = new Set([
  // Host routing / infra
  "admin",
  "www",
  "localhost",
  "app",
  "api",
  "auth",
  // First-party root paths (multi-tenant)
  "onboarding",
  "select-destination",
]);

/** Normalizes arbitrary input into a URL-safe tenant slug (hyphenated lowercase ASCII). */
export function slugifyTenantName(input: string) {
  const slug = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "tenant";
}

export function isReservedTenantSlug(slug: string) {
  return RESERVED_TENANT_SLUGS.has(slug.trim().toLowerCase());
}

/**
 * Mirrors `buildHostForTenant` in `@/lib/tenant-host` for preview strings on the client
 * without pulling in server-only utilities.
 */
export function buildTenantHostnamePreview(args: {
  slug: string;
  hostname: string;
  rootDomain: string;
  port: string | null;
}): string {
  const normalizedSlug = slugifyTenantName(args.slug);

  const localBaseHost =
    args.hostname === "localhost" ||
    args.hostname === "127.0.0.1" ||
    args.hostname.endsWith(".localhost") ||
    args.hostname.endsWith(".127.0.0.1");

  if (localBaseHost) {
    const localRoot =
      args.hostname === "localhost" || args.hostname.endsWith(".localhost")
        ? "localhost"
        : "127.0.0.1";
    const portSuffix = args.port ? `:${args.port}` : "";
    return `${normalizedSlug}.${localRoot}${portSuffix}`;
  }

  const normalizedHost = args.hostname.trim().toLowerCase();
  const normalizedRoot = args.rootDomain.trim().toLowerCase();
  const platformAdminHostname = `admin.${normalizedRoot}`;

  if (
    normalizedHost.endsWith(".localtest.me") &&
    normalizedHost !== platformAdminHostname
  ) {
    const portSuffix = args.port ? `:${args.port}` : "";
    return `${normalizedSlug}.${args.hostname}${portSuffix}`;
  }

  const portSuffix = args.port ? `:${args.port}` : "";
  return `${normalizedSlug}.${args.rootDomain}${portSuffix}`;
}
