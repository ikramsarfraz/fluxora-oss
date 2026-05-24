import { permanentRedirect } from "next/navigation";

/**
 * Legacy URL — the page moved to `/prices` to match the sidebar label.
 * Returns a 308 permanent redirect so the browser updates bookmarks and
 * external link sources start hitting the new path directly.
 */
export default function LegacyPriceChartRedirect() {
  permanentRedirect("/prices");
}
