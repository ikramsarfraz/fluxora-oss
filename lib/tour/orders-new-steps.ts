/**
 * Guided tour for `/orders/new` — the New Sales Order form.
 *
 * Steps anchor on `[data-tour-target="..."]` attributes wired into the form.
 * If a step's anchor isn't on screen (e.g. AI-paste pill is hidden for a
 * tenant without the feature flag), the coach card falls back to a centered
 * position with no spotlight — same behaviour as the cold-start tour.
 */

import type { TourStep } from "./types";

export const ordersNewTourSteps: readonly TourStep[] = [
  {
    kind: "live",
    target: "[data-tour-target='orders-new.page-title']",
    placement: "bottom",
    pad: 6,
    label: "Step 1 · Order entry",
    title: "Capture a sales order in under a minute.",
    text: "Pick the customer, add the line items, and confirm. Quantities can stay rough — final weights and totals are captured during fulfillment, not here.",
    hint: {
      icon: "↘",
      text: "Total time on this tour: about <strong>45 seconds</strong>. Press <kbd>←</kbd> / <kbd>→</kbd> to navigate.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='orders-new.ai-pill']",
    placement: "bottom",
    pad: 8,
    label: "Step 2 · AI paste",
    title: "Skip the typing when a customer texts you the order.",
    text: "Paste the customer&rsquo;s WhatsApp, SMS, or email here. We&rsquo;ll match the customer, line items, and delivery date — you confirm before saving.",
    hint: {
      icon: "⌘",
      text: "Press <kbd>⌘</kbd> + <kbd>V</kbd> anywhere on the page to open this drawer with the clipboard contents pre-pasted.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='orders-new.customer-card']",
    placement: "right",
    pad: 6,
    label: "Step 3 · Customer",
    title: "Customer drives the price book.",
    text: "Picking a customer here loads their contract pricing, fuel surcharge, and credit-limit check. Everything below stays empty until you choose one.",
    hint: {
      icon: "§",
      text: "Same picker works on the AI paste flow — if the message named the customer clearly, we auto-fill this for you.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='orders-new.lines-table']",
    placement: "top",
    pad: 6,
    label: "Step 4 · Line items",
    title: "One row per product, per unit.",
    text: "Pick the product, set cases, type a price if it differs from the contract default. Catch-weight lines capture per-case weights at fulfillment, not now.",
    hint: {
      icon: "→",
      text: "Pricing falls back to the customer&rsquo;s contract for the product when the row is left blank.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='orders-new.estimate-sidebar']",
    placement: "left",
    pad: 6,
    label: "Step 5 · Estimate",
    title: "Subtotals update as you type.",
    text: "Fuel surcharge and any discount apply on top of the line subtotals. This is an estimate — the final invoice resolves catch-weight totals from real fulfillment weights.",
    hint: {
      icon: "§",
      text: "Values use tabular numerals so columns line up across the sidebar and the lines table.",
    },
  },
  {
    kind: "done",
    label: "All set",
    title: "Ready to save your first order.",
    text: "Save as a draft to keep refining, or confirm to lock it in. Confirmed orders allocate inventory and count against the monthly plan limit; drafts do not.",
    primaryCta: { label: "Got it →", href: "/orders/new" },
  },
] satisfies readonly TourStep[];

export const ORDERS_NEW_TOUR_COMPLETION_KEY =
  "fluxora.tour.ordersNew.completedAt";
