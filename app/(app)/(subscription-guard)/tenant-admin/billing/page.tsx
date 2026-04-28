import { redirect } from "next/navigation";

/** Legacy `/tenant-admin/billing`; tenant UI lives under `/account/billing`. */
export default function LegacyTenantBillingRedirectPage() {
  redirect("/account/billing");
}
