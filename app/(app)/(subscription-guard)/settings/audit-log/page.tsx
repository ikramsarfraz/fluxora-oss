import { permanentRedirect } from "next/navigation";

export default function LegacyAuditLogRedirect() {
  permanentRedirect("/settings/security/activity-log");
}
