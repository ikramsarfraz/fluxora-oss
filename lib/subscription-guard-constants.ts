/**
 * Request header carrying the browser path for tenant `app/(app)` subscription enforcement.
 * Forwarded from `proxy.ts`; must match `resolveTenantAppPathname()` in `lib/subscription-guard-pathname.ts`.
 */
export const TENANT_ROUTE_PATH_HEADER = "x-internal-pathname";
