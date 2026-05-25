import { redirect } from "next/navigation";

export default async function SupplierCompareRedirect({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const params = new URLSearchParams({ view: "compare" });
  if (category) params.set("category", category);
  redirect(`/suppliers?${params.toString()}`);
}
