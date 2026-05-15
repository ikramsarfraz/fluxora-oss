import { redirect } from "next/navigation";

export default function SecuritySettingsIndexPage() {
  redirect("/settings/security/activity-log");
}
