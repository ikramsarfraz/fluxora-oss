/**
 * Guided tour for `/supplier-invoices/new` — the Record Bill form.
 *
 * Anchors on `[data-tour-target="..."]` attributes in the form. The PDF
 * upload + bulk-import flow shares this page, so the tour deliberately
 * covers both the manual-entry path and the AI/PDF ingestion paths.
 */

import type { TourStep } from "./types";

export const billsNewTourSteps: readonly TourStep[] = [
  {
    kind: "live",
    target: "[data-tour-target='bills-new.page-title']",
    placement: "bottom",
    pad: 6,
    label: "Step 1 · Record a bill",
    title: "Three paths to the same draft.",
    text: "Paste the bill text, scan a PDF, or enter every line by hand. Each route lands you on the same review surface — same supplier picker, same line items, same charges.",
    hint: {
      icon: "↘",
      text: "Total time on this tour: about <strong>60 seconds</strong>. Press <kbd>←</kbd> / <kbd>→</kbd> to navigate.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='bills-new.ai-pill']",
    placement: "bottom",
    pad: 8,
    label: "Step 2 · AI paste",
    title: "Bill arrived as a message, not a PDF.",
    text: "Paste the supplier&rsquo;s email body or text message. AI extracts the supplier, invoice number, dates, line items, and freight/fuel charges, then drops you on the same review screen the PDF flow uses.",
    hint: {
      icon: "⌘",
      text: "Press <kbd>⌘</kbd> + <kbd>V</kbd> anywhere on this page to open the drawer with the clipboard contents.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='bills-new.scan-pdf']",
    placement: "left",
    pad: 8,
    label: "Step 3 · Scan PDF",
    title: "Most bills arrive as a PDF.",
    text: "Upload a PDF and the parser handles text extraction, line matching, supplier lookup, and fee detection. Multi-page bills go through the bulk-import queue automatically.",
    hint: {
      icon: "§",
      text: "Bulk uploads (a folder of PDFs) work from the Bills list page — this button is for the single-bill path.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='bills-new.bill-details']",
    placement: "top",
    pad: 6,
    label: "Step 4 · Bill details",
    title: "Supplier, invoice number, dates.",
    text: "Supplier is required — it&rsquo;s how the bill links into your costs, payment terms, and aging. Invoice number is optional (we mint an internal reference if the printed one is blank or illegible).",
    hint: {
      icon: "→",
      text: "Pick a supplier that doesn&rsquo;t exist yet? Use &ldquo;+ Create supplier&rdquo; right under the dropdown.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='bills-new.line-items']",
    placement: "top",
    pad: 6,
    label: "Step 5 · Line items",
    title: "Each line creates a lot when received.",
    text: "Variable-weight products capture per-case weights here. Fixed-case items take just a price. The Add Line button lives at the bottom of this card.",
    hint: {
      icon: "§",
      text: "Catch-weight lines need weights at receive time before they post to inventory; price stays fixed per pound.",
    },
  },
  {
    kind: "live",
    target: "[data-tour-target='bills-new.charges']",
    placement: "top",
    pad: 6,
    label: "Step 6 · Non-inventory charges",
    title: "Freight, fuel surcharge, taxes, cut fees.",
    text: "Charges that aren&rsquo;t inventory go here. They roll into the invoice total but don&rsquo;t create lots. Mark them &ldquo;in COGS&rdquo; per line if they should be allocated across the inventory.",
    hint: {
      icon: "↗",
      text: "Detected fees auto-populate when you arrive via PDF or AI paste — you can reclassify or remove them before saving.",
    },
  },
  {
    kind: "done",
    label: "All set",
    title: "Save as draft or complete &amp; receive.",
    text: "Save draft keeps the bill open for editing. Complete &amp; receive locks it in: lots are created, inventory updates, and the bill enters your AP aging.",
    primaryCta: { label: "Got it →", href: "/supplier-invoices/new" },
  },
] satisfies readonly TourStep[];

export const BILLS_NEW_TOUR_COMPLETION_KEY =
  "fluxora.tour.billsNew.completedAt";
