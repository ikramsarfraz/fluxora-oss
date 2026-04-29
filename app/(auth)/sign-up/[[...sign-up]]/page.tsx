import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/app/(auth)/sign-up/[[...sign-up]]/components/sign-up-form";
import { isGoogleAuthEnabled } from "@/lib/google-auth-flow";
import { buildRootAppUrl, buildTenantAppUrl } from "@/lib/tenant-host";
import { getTenantHostInvitationRedirect } from "@/services/invitations";
import { getCurrentRequestTenant } from "@/services/tenants";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tenantRequest = await getCurrentRequestTenant();
  const rootLoginUrl = buildRootAppUrl({
    pathname: "/login",
    context: tenantRequest,
  });
  const tenantLoginUrl = tenantRequest.tenant
    ? buildTenantAppUrl({
        slug: tenantRequest.tenant.slug,
        pathname: "/login",
        context: tenantRequest,
      })
    : tenantRequest.inactiveTenant
      ? buildTenantAppUrl({
          slug: tenantRequest.inactiveTenant.slug,
          pathname: "/login",
          context: tenantRequest,
        })
      : rootLoginUrl;

  if (tenantRequest.tenant && token) {
    const inviteRedirect = await getTenantHostInvitationRedirect({
      tenantSlug: tenantRequest.tenant.slug,
      token,
    });

    if (inviteRedirect.ok) {
      redirect(`/invite/${inviteRedirect.token}`);
    }
  }

  return (
    <Suspense>
      <SignUpForm
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
        isRootHost={tenantRequest.isRootHost}
        rootDomain={tenantRequest.rootDomain}
        rootLoginUrl={rootLoginUrl}
        tenantLoginUrl={tenantLoginUrl}
        inviteToken={token ?? null}
        googleEnabled={isGoogleAuthEnabled()}
      />
    </Suspense>
  );
}
