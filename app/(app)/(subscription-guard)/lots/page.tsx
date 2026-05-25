import { permanentRedirect } from "next/navigation";

export default function LegacyLotsListRedirect() {
  permanentRedirect("/inventory/lots");
}
