import { permanentRedirect } from "next/navigation";

export default function LegacyTenantAdminRolesRedirect() {
  permanentRedirect("/settings/team/roles");
}
