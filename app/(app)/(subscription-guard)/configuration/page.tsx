import { permanentRedirect } from "next/navigation";

const TAB_MAP: Record<string, string> = {
  branding: "/settings/workspace/general",
  categories: "/settings/workspace/categories",
  uom: "/settings/workspace/units-of-measure",
};

export default async function LegacyConfigurationRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : undefined;
  permanentRedirect(TAB_MAP[tab ?? ""] ?? "/settings/workspace/general");
}
