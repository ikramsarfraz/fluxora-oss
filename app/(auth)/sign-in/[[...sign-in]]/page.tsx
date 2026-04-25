import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignInForm } from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form";
import { isGoogleAuthEnabled } from "@/lib/google-auth-flow";
import { buildRootAppUrl, buildTenantAppUrl } from "@/lib/tenant-host";
import { resolveExistingSessionLoginDestination } from "@/services/auth";
import { getCurrentRequestTenant } from "@/services/tenants";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const existingSessionDestination = await resolveExistingSessionLoginDestination({
    callbackUrl,
  });

  if (existingSessionDestination) {
    redirect(existingSessionDestination);
  }

  const tenantRequest = await getCurrentRequestTenant();

  const rootSignUpUrl = buildRootAppUrl({
    pathname: "/signup",
    context: tenantRequest,
  });
  const tenantSignUpUrl =
    tenantRequest.tenant || tenantRequest.inactiveTenant
      ? buildTenantAppUrl({
          slug:
            tenantRequest.tenant?.slug ?? tenantRequest.inactiveTenant?.slug ?? "",
          pathname: "/signup",
          context: tenantRequest,
        })
      : rootSignUpUrl;

  return (
    <Suspense>
      <SignInForm
        tenant={
          tenantRequest.tenant
            ? {
                id: tenantRequest.tenant.id,
                name: tenantRequest.tenant.name,
                slug: tenantRequest.tenant.slug,
              }
            : null
        }
        inactiveTenant={
          tenantRequest.inactiveTenant
            ? {
                id: tenantRequest.inactiveTenant.id,
                name: tenantRequest.inactiveTenant.name,
                slug: tenantRequest.inactiveTenant.slug,
              }
            : null
        }
        tenantSlug={tenantRequest.tenantSlug}
        isRootHost={tenantRequest.isRootHost}
        isPlatformAdminHost={tenantRequest.isPlatformAdminHost}
        rootDomain={tenantRequest.rootDomain}
        protocol={tenantRequest.protocol}
        port={tenantRequest.port}
        rootSignUpUrl={rootSignUpUrl}
        signUpUrl={tenantSignUpUrl}
        googleEnabled={isGoogleAuthEnabled()}
      />
    </Suspense>
  );
}
