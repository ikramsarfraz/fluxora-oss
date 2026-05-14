import { permanentRedirect } from "next/navigation";

export default async function LegacyLotDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/inventory/lots/${id}`);
}
