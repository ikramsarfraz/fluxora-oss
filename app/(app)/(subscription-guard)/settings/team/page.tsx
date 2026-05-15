import { redirect } from "next/navigation";

export default function TeamSettingsIndexPage() {
  redirect("/settings/team/members");
}
