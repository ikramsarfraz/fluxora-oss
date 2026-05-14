import { eq } from "drizzle-orm";

import { db } from "@/db";
import { portalUsers } from "@/db/schema";
import { ROLE_ORDER } from "@/lib/auth/permission-levels";
import { getInitials } from "@/lib/utils/get-initials";
import { formatAuthUserDisplayName } from "@/lib/user-display-name";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";
import {
  RolesPermissionsHub,
  type RoleMemberSummary,
} from "@/modules/core/workspace-settings/components/roles/roles-permissions-hub";

export default async function RolesSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Roles & Permissions" />;
  }

  // Members per role come from `portal_users`. Server-side so the rail and
  // member chips can render without a client fetch.
  const tenantMembers = await db.query.portalUsers.findMany({
    where: eq(portalUsers.tenantId, current.tenantId),
    with: { authUser: true },
    columns: { id: true, role: true, fullName: true },
  });

  const roleMembers: RoleMemberSummary[] = ROLE_ORDER.map(role => ({
    role,
    members: tenantMembers
      .filter(m => m.role === role)
      .map(m => {
        const displayName =
          m.fullName ??
          formatAuthUserDisplayName({
            name: m.authUser?.name ?? null,
            email: m.authUser?.email ?? null,
          });
        return {
          id: m.id,
          fullName: displayName,
          initials: getInitials(displayName).slice(0, 2).toUpperCase(),
        };
      }),
  }));

  return (
    <RolesPermissionsHub
      roleMembers={roleMembers}
      defaultRole={current.role}
      highlightRole={current.role}
    />
  );
}
