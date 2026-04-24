import { Suspense } from "react";
import { SignInForm } from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form";
import { isGoogleAuthEnabled } from "@/lib/google-auth-flow";
import { buildRootAppUrl } from "@/lib/tenant-host";
import { getCurrentRequestTenant } from "@/services/tenants";

export default async function SignInPage() {
  const tenantRequest = await getCurrentRequestTenant();

  // DEBUG — remove after UAT diagnosis
  console.log("[sign-in page] tenantRequest", {
    host: tenantRequest.host,
    hostname: tenantRequest.hostname,
    port: tenantRequest.port,
    protocol: tenantRequest.protocol,
    rootDomain: tenantRequest.rootDomain,
    tenantSlug: tenantRequest.tenantSlug,
    isRootHost: tenantRequest.isRootHost,
    tenantId: tenantRequest.tenant?.id ?? null,
    tenantName: tenantRequest.tenant?.name ?? null,
  });

  const rootSignUpUrl = buildRootAppUrl({
    pathname: "/signup",
    context: tenantRequest,
  });

  return (
    <Suspense>
      <SignInForm
        tenant={tenantRequest.tenant ? {
          id: tenantRequest.tenant.id,
          name: tenantRequest.tenant.name,
          slug: tenantRequest.tenant.slug,
        } : null}
        inactiveTenant={tenantRequest.inactiveTenant ? {
          id: tenantRequest.inactiveTenant.id,
          name: tenantRequest.inactiveTenant.name,
          slug: tenantRequest.inactiveTenant.slug,
        } : null}
        tenantSlug={tenantRequest.tenantSlug}
        isRootHost={tenantRequest.isRootHost}
        isPlatformAdminHost={tenantRequest.isPlatformAdminHost}
        rootDomain={tenantRequest.rootDomain}
        protocol={tenantRequest.protocol}
        port={tenantRequest.port}
        rootSignUpUrl={rootSignUpUrl}
        googleEnabled={isGoogleAuthEnabled()}
      />
    </Suspense>
  );
}
