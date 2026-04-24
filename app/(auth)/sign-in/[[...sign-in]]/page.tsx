import { Suspense } from "react";
import { SignInForm } from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form";
import { isGoogleAuthEnabled } from "@/lib/google-auth-flow";
import { buildRootAppUrl } from "@/lib/tenant-host";
import { getCurrentRequestTenant } from "@/services/tenants";

export default async function SignInPage() {
  const tenantRequest = await getCurrentRequestTenant();
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
        tenantSlug={tenantRequest.tenantSlug}
        isRootHost={tenantRequest.isRootHost}
        rootDomain={tenantRequest.rootDomain}
        protocol={tenantRequest.protocol}
        port={tenantRequest.port}
        rootSignUpUrl={rootSignUpUrl}
        googleEnabled={isGoogleAuthEnabled()}
      />
    </Suspense>
  );
}
