import { permanentRedirect } from "next/navigation";

export default function LegacyBanksRedirect() {
  permanentRedirect("/settings/integrations/banks");
}
