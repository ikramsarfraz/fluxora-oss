import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TenantChooserCard } from "@/components/tenant-chooser-card";
import { auth } from "@/lib/auth";
import {
  completeAuthenticatedPlatformAdminSelection,
  completeAuthenticatedTenantSelection,
  completeEmailSelectPlatformHandoff,
  completeEmailSelectTenantHandoff,
  completeGooglePlatformAdminSelection,
  completeGoogleTenantSelection,
  getGoogleTenantChooserData,
  loadAuthenticatedDestinationSelectView,
  loadEmailDestinationSelectView,
} from "@/services/auth";

export const dynamic = "force-dynamic";

const CHOOSER_TITLE = "Choose your workspace";
const CHOOSER_DESCRIPTION =
  "Your account is linked to more than one destination. Pick one to continue.";

export default async function SelectDestinationPage({
  searchParams,
}: {
    searchParams: Promise<{
      flow?: string;
      tenant?: string;
      destination?: string;
      emailSelect?: string;
      returnTo?: string;
    }>;
}) {
  const { flow, tenant, destination, emailSelect, returnTo } =
    await searchParams;

  // Email destination flow: after picking a workspace, same as Google (session → dashboard).
  if (emailSelect && !flow) {
    if (tenant) {
      let url: string;
      try {
        url = await completeEmailSelectTenantHandoff({
          emailSelectToken: emailSelect,
          tenantSlug: tenant,
        });
      } catch (error) {
        const msg =
          error instanceof Error
            ? encodeURIComponent(error.message)
            : "email_tenant_error";
        redirect(`/login?error=${msg}`);
      }
      redirect(url);
    }

    if (destination === "platform_admin") {
      let url: string;
      try {
        url = await completeEmailSelectPlatformHandoff({
          emailSelectToken: emailSelect,
        });
      } catch (error) {
        const msg =
          error instanceof Error
            ? encodeURIComponent(error.message)
            : "email_platform_error";
        redirect(`/login?error=${msg}`);
      }
      redirect(url);
    }

    // Show chooser or handoff redirect for a single option.
    let result;
    try {
      result = await loadEmailDestinationSelectView(emailSelect);
    } catch {
      redirect("/login?error=email_select_invalid");
    }
    if (result.view === "redirect") {
      redirect(result.url);
    }
    return (
      <TenantChooserCard
        destinations={result.destinations}
        title={CHOOSER_TITLE}
        description={CHOOSER_DESCRIPTION}
      />
    );
  }

  // Google OAuth: session required.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!flow) {
    if (!session?.user?.id) {
      redirect(
        `/login${returnTo ? `?callbackUrl=${encodeURIComponent(returnTo)}` : ""}`,
      );
    }

    if (tenant) {
      let url: string;
      try {
        url = await completeAuthenticatedTenantSelection({
          authUserId: session.user.id,
          sessionId: session.session.id,
          tenantSlug: tenant,
          returnTo,
        });
      } catch (error) {
        const msg =
          error instanceof Error
            ? encodeURIComponent(error.message)
            : "dest_select_tenant_error";
        redirect(`/login?error=${msg}`);
      }
      redirect(url);
    }

    if (destination === "platform_admin") {
      let url: string;
      try {
        url = await completeAuthenticatedPlatformAdminSelection({
          authUserId: session.user.id,
          sessionId: session.session.id,
        });
      } catch (error) {
        const msg =
          error instanceof Error
            ? encodeURIComponent(error.message)
            : "dest_select_platform_error";
        redirect(`/login?error=${msg}`);
      }
      redirect(url);
    }

    const result = await loadAuthenticatedDestinationSelectView({
      authUserId: session.user.id,
      sessionId: session.session.id,
      returnTo,
    });

    if (result.view === "redirect") {
      redirect(result.url);
    }

    return (
      <TenantChooserCard
        destinations={result.destinations}
        title={CHOOSER_TITLE}
        description={CHOOSER_DESCRIPTION}
      />
    );
  }

  if (!session?.user?.id) {
    redirect("/login?error=google_no_session");
  }

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

  if (destination === "platform_admin") {
    let url: string;
    try {
      url = await completeGooglePlatformAdminSelection({
        flowToken: flow,
        authUserId: session.user.id,
        sessionId: session.session.id,
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? encodeURIComponent(error.message)
          : "google_platform_error";
      redirect(`/login?error=${msg}`);
    }
    redirect(url);
  }

  let chooserData: Awaited<ReturnType<typeof getGoogleTenantChooserData>>;
  try {
    chooserData = await getGoogleTenantChooserData({
      flowToken: flow,
      authUserId: session.user.id,
    });
  } catch {
    redirect("/login?error=google_error");
  }

  if (chooserData.destinations.length === 0) {
    redirect("/onboarding");
  }

  return (
    <TenantChooserCard
      destinations={chooserData.destinations}
      title={CHOOSER_TITLE}
      description={CHOOSER_DESCRIPTION}
    />
  );
}
