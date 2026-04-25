import { redirect } from "next/navigation";

/**
 * Old path; destination chooser now lives at /select-destination.
 */
export default async function LegacyGoogleSelectTenantRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach(v => q.append(key, v));
    } else {
      q.set(key, value);
    }
  }
  redirect(`/select-destination?${q.toString()}`);
}
