import { Suspense } from "react";
import { SignUpForm } from "@/app/(auth)/sign-up/[[...sign-up]]/components/sign-up-form";
import { isGoogleAuthEnabled } from "@/lib/google-auth-flow";
import { buildRootAppUrl } from "@/lib/tenant-host";
import { getCurrentRequestTenant } from "@/services/tenants";

export default async function SignUpPage() {
  const tenantRequest = await getCurrentRequestTenant();
  const rootLoginUrl = buildRootAppUrl({
    pathname: "/login",
    context: tenantRequest,
  });

  return (
    <Suspense>
      <SignUpForm
        tenant={tenantRequest.tenant ? {
          id: tenantRequest.tenant.id,
          name: tenantRequest.tenant.name,
          slug: tenantRequest.tenant.slug,
        } : null}
        isRootHost={tenantRequest.isRootHost}
        rootDomain={tenantRequest.rootDomain}
        protocol={tenantRequest.protocol}
        port={tenantRequest.port}
        rootLoginUrl={rootLoginUrl}
        googleEnabled={isGoogleAuthEnabled()}
      />
    </Suspense>
  );
}
