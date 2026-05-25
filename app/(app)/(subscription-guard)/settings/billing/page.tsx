import { redirect } from "next/navigation";

export default function BillingSettingsIndexPage() {
  redirect("/settings/billing/plan-and-usage");
}
