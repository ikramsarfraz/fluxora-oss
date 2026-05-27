/**
 * Registry of available product tours. Adding a new tour means:
 *  1. Author its step array in a sibling file (cold-start-steps.ts,
 *     orders-new-steps.ts, …) using the shared `TourStep` types.
 *  2. Add an entry to `TOURS` below with a stable id, the steps array, a
 *     storage key for completion tracking, and the route prefix it should
 *     surface on in the help drawer.
 *
 * Consumers:
 *   - `ProductTour` reads the active tour by id (event detail), defaulting
 *     to "cold-start" so the existing dashboard CTA keeps working.
 *   - `HelpSheet` calls `tourForPathname()` to decide which CTA to offer
 *     based on the user's current route.
 */

import {
  coldStartTourSteps,
  TOUR_COMPLETION_KEY as COLD_START_KEY,
} from "./cold-start-steps";
import {
  ordersNewTourSteps,
  ORDERS_NEW_TOUR_COMPLETION_KEY,
} from "./orders-new-steps";
import {
  billsNewTourSteps,
  BILLS_NEW_TOUR_COMPLETION_KEY,
} from "./bills-new-steps";
import type { TourStep } from "./types";

export type TourId = "cold-start" | "orders-new" | "bills-new";

export type TourDefinition = {
  id: TourId;
  /** Display label used inside the help drawer ("Cold-start tour", "Sales-order walkthrough"). */
  label: string;
  /** One-line summary shown under the label in the drawer card. */
  description: string;
  /** Rough duration shown as a chip next to the label. */
  duration: string;
  /** Step array consumed by `ProductTour`. */
  steps: readonly TourStep[];
  /** LocalStorage key marking the user's last completion. */
  storageKey: string;
  /**
   * Routes where this tour should be offered. Matched with `startsWith`,
   * so "/orders/new" anchors `/orders/new`, `/orders/new/duplicate`, etc.
   */
  routes: readonly string[];
};

export const TOURS: Record<TourId, TourDefinition> = {
  "cold-start": {
    id: "cold-start",
    label: "Cold-start tour",
    description:
      "Walk through the four steps to your first invoice — what each card on the dashboard means and what fills it in.",
    duration: "60 sec",
    steps: coldStartTourSteps,
    storageKey: COLD_START_KEY,
    routes: ["/dashboard", "/"],
  },
  "orders-new": {
    id: "orders-new",
    label: "Sales-order walkthrough",
    description:
      "See how the new-order form is laid out — customer, lines, AI paste, estimate sidebar, save draft.",
    duration: "45 sec",
    steps: ordersNewTourSteps,
    storageKey: ORDERS_NEW_TOUR_COMPLETION_KEY,
    routes: ["/orders/new"],
  },
  "bills-new": {
    id: "bills-new",
    label: "Record-bill walkthrough",
    description:
      "Three paths to record a supplier bill: paste text, scan PDF, manual entry — plus the line-items + charges flow.",
    duration: "60 sec",
    steps: billsNewTourSteps,
    storageKey: BILLS_NEW_TOUR_COMPLETION_KEY,
    routes: ["/supplier-invoices/new"],
  },
};

/**
 * Pick the right tour for the current route. Longer route prefixes win
 * (so "/orders/new" beats "/orders") even though the cold-start tour also
 * lists "/" — we sort by descending prefix length before matching.
 */
export function tourForPathname(pathname: string | null): TourDefinition | null {
  if (!pathname) return null;
  const entries = Object.values(TOURS)
    .flatMap(t => t.routes.map(route => ({ tour: t, route })))
    .sort((a, b) => b.route.length - a.route.length);
  for (const { tour, route } of entries) {
    if (route === "/") {
      if (pathname === "/") return tour;
      continue;
    }
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return tour;
    }
  }
  return null;
}

export function tourById(id: string | null | undefined): TourDefinition | null {
  if (!id) return null;
  return id in TOURS ? TOURS[id as TourId] : null;
}

export function markTourComplete(id: TourId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOURS[id].storageKey, new Date().toISOString());
}
