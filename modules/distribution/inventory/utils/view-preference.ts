/**
 * Per-user inventory hub view preference. Stored client-side under one key so
 * the hub root (`/inventory`) and the view toggle stay in sync.
 *
 * The README calls for a server-side user-prefs store ("user prefs, not
 * workspace prefs"). localStorage is the stopgap until a per-user prefs table
 * lands — it gets us per-device persistence with zero schema work. The URL
 * is authoritative when explicit (`/inventory/items` / `/inventory/lots`).
 */
export const INVENTORY_VIEW_STORAGE_KEY = "fluxora.inventory.view";

export type InventoryView = "items" | "lots";

export function rememberInventoryView(view: InventoryView): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INVENTORY_VIEW_STORAGE_KEY, view);
    }
  } catch {
    // localStorage may be unavailable (private-browsing, quota). Silently ignore.
  }
}
