import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  completeGoogleTenantSelection,
  getGoogleTenantChooserData,
} from "@/services/auth";
import { TenantChooserCard } from "./components/tenant-chooser-card";

export const dynamic = "force-dynamic";

export default async function GoogleSelectTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string; tenant?: string }>;
}) {
  const { flow, tenant } = await searchParams;

  if (!flow) {
    redirect("/login?error=google_missing_flow");
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/login?error=google_no_session");
  }

  // User picked a specific tenant — finalize and redirect.
  if (tenant) {
    let url: string;
    try {
      url = await completeGoogleTenantSelection({
        flowToken: flow,
        tenantSlug: tenant,
        authUserId: session.user.id,
        sessionId: session.session.id,
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? encodeURIComponent(error.message)
          : "google_tenant_error";
      redirect(`/login?error=${msg}`);
    }
    redirect(url);
  }

  // Show the tenant chooser.
  let chooserData: Awaited<ReturnType<typeof getGoogleTenantChooserData>>;
  try {
    chooserData = await getGoogleTenantChooserData({
      flowToken: flow,
      authUserId: session.user.id,
    });
  } catch {
    redirect("/login?error=google_error");
  }

  if (chooserData.tenants.length === 0) {
    redirect("/signup?oauthError=no_tenants");
  }

  return <TenantChooserCard tenants={chooserData.tenants} />;
}
