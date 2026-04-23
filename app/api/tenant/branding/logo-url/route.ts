export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getCurrentTenant, getTenantLogoUrl } from "@/services/tenants";

/**
 * GET /api/tenant/branding/logo-url
 * Returns a short-lived signed R2 URL for the tenant's current logo,
 * or { url: null } if no logo has been uploaded.
 */
export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    const url = await getTenantLogoUrl(tenant);
    return Response.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return Response.json({ error: message }, { status: 401 });
  }
}
