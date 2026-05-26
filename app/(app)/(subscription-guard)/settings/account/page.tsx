import { redirect } from "next/navigation";

export default function AccountSettingsIndexPage() {
  redirect("/settings/account/profile");
}
