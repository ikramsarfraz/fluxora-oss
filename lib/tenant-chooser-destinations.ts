import type { LoginDestinationDiscoveryItem } from "@/services/auth";
import {
  buildRootAppUrl,
  type RequestTenantHostContext,
} from "@/lib/tenant-host";
import type { TenantChooserDestination } from "@/components/tenant-chooser-card";

export type { TenantChooserDestination };

/**
 * Chooser links go to the same host as Google: `/select-destination?emailSelect&tenant=…`
 * (or `…&destination=platform_admin`) so an existing session can complete and
 * redirect to `/dashboard` without another login.
 */
export function mapLoginDiscoveryToTenantChooserDestinations(
  items: LoginDestinationDiscoveryItem[],
  context: RequestTenantHostContext,
  emailSelectToken: string,
): TenantChooserDestination[] {
  const portSuffix = context.port ? `:${context.port}` : "";
  const hostLine = (slug: string) =>
    `${slug}.${context.rootDomain}${portSuffix}`;

  return items.map(item => {
    if (item.type === "tenant") {
      return {
        type: "tenant" as const,
        tenantId: item.tenantId,
        tenantName: item.tenantName,
        tenantSlug: item.tenantSlug,
        role: item.role,
        continueUrl: buildRootAppUrl({
          pathname: "/select-destination",
          searchParams: {
            emailSelect: emailSelectToken,
            tenant: item.tenantSlug,
          },
          context,
        }),
        subtitle: hostLine(item.tenantSlug),
      };
    }
    return {
      type: "platform_admin" as const,
      id: "platform-admin",
      name: item.name,
      role: item.role,
      continueUrl: buildRootAppUrl({
        pathname: "/select-destination",
        searchParams: {
          emailSelect: emailSelectToken,
          destination: "platform_admin",
        },
        context,
      }),
      subtitle: hostLine("admin"),
    };
  });
}
