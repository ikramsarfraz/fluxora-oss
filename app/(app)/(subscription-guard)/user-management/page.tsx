import { permanentRedirect } from "next/navigation";

const TAB_MAP: Record<string, string> = {
  users: "/settings/team/members",
  roles: "/settings/team/roles",
};

export default async function LegacyUserManagementRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : undefined;
  permanentRedirect(TAB_MAP[tab ?? ""] ?? "/settings/team/members");
}
