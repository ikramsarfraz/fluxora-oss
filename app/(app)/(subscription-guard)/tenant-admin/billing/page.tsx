import { redirect } from "next/navigation";

/** Legacy `/tenant-admin/billing`; tenant UI lives under `/settings/billing/plan-and-usage`. */
export default function LegacyTenantBillingRedirectPage() {
  redirect("/settings/billing/plan-and-usage");
}
