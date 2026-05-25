"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { INVENTORY_VIEW_STORAGE_KEY } from "@/modules/distribution/inventory/utils/view-preference";

/**
 * Inventory hub root. Restores the user's last-selected view from localStorage,
 * defaulting to /inventory/items for first-time users. The URL is authoritative
 * when present (someone shares `/inventory/lots`) — that path lands directly,
 * so this redirect only runs when the user navigates to the bare `/inventory`.
 */
export default function InventoryIndexPage() {
  const router = useRouter();
  useEffect(() => {
    let target = "/inventory/items";
    try {
      const saved =
        typeof window !== "undefined"
          ? window.localStorage.getItem(INVENTORY_VIEW_STORAGE_KEY)
          : null;
      if (saved === "lots") target = "/inventory/lots";
    } catch {
      // localStorage can throw in private-browsing / quota-exceeded — fall through.
    }
    router.replace(target);
  }, [router]);
  return null;
}
