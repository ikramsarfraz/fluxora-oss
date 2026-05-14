import { permanentRedirect } from "next/navigation";

export default async function LegacyInventoryItemRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/inventory/items/${id}`);
}
