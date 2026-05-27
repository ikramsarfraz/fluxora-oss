// Deterministic preview-chip extraction for the AI paste composer.
//
// The composer's drawer shows a "live preview" chip strip while the user
// types so they see what AI will match BEFORE committing. The production
// spec calls for a debounced parse-preview endpoint; this file is the
// no-AI-cost fallback — pure regex + heuristics — so the chip strip is
// useful from the first keystroke without burning OpenAI cycles per
// debounce tick.
//
// The real `parseSalesOrderTextAction` / `parseBillTextAction` still runs
// when the user clicks "Parse and fill". The deterministic chips are just
// a directional hint; expect ~70-90% precision on clean messages and
// substantially worse on heavily abbreviated or punctuation-light text —
// which is exactly the right confidence to surface as "low" so users know
// to double-check.

import type { AiPasteChip } from "@/components/ai-composer/ai-composer";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DATE_RE =
  /\b(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{2,4})?)\b/i;

const WEEKDAY_RE =
  /\b(today|tomorrow|asap|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+\w+|this\s+\w+)\b/i;

const INVOICE_NUMBER_RE = /(?:invoice\s*#?|inv\.?\s*#?|bill\s*#?)\s*([A-Z0-9-]{2,})/i;
const HASH_NUMBER_RE = /#([A-Z0-9-]{2,})/i;

// "20 cases ribeye", "5 cs chicken thigh", "4 boxes of milk".
// Captures the count + unit + product phrase up to the next punctuation
// (comma, semicolon, period at sentence boundary, " and ", or end of text).
const LINE_RE =
  /(\d+(?:\.\d+)?)\s*(cases?|cs|boxes?|bx|bags?|each|ea|lbs?|pounds?|cans?|gal(?:lons?)?|cs)\s*(?:of\s+)?([a-z][a-z0-9\s'/&-]{2,60}?)(?=\s*(?:[,.;]|\sand\s|$|\n))/gi;

// Freight / fee charges: "$45 freight", "freight $45", "fuel surcharge $12".
const CHARGE_RE =
  /(?:(\$?\d+(?:\.\d+)?)\s*(?:in\s+)?(freight|delivery|fuel(?:\s+surcharge)?|shipping|processing|cod|tax)|(freight|delivery|fuel(?:\s+surcharge)?|shipping|processing|cod|tax)(?:\s+(?:charge|fee))?\s*[:\-]?\s*\$?(\d+(?:\.\d+)?))/gi;

// Trim trailing connectors and tidy whitespace.
function tidyPhrase(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:of|the|a|an)\s+/i, "")
    .trim();
}

// "From <Name>, …" / "<Name> here" / "this is <Name>" — short, signal-bearing
// patterns common in WhatsApp / SMS orders. Falls through to the first run
// of capitalized words if nothing else matches.
function findOrgName(text: string): { name: string; conf: number } | null {
  const introMatch = text.match(
    /\b(?:from|this is|hi,?\s+(?:this\s+is)?|hey,?\s+(?:this\s+is)?|it's)\s+([A-Z][\w'&\-]*(?:\s+[A-Z][\w'&\-]*){0,3})/,
  );
  if (introMatch) {
    return { name: tidyPhrase(introMatch[1]), conf: 90 };
  }
  // "<Name> here"
  const hereMatch = text.match(
    /\b([A-Z][\w'&\-]*(?:\s+[A-Z][\w'&\-]*){0,3})\s+here\b/,
  );
  if (hereMatch) {
    return { name: tidyPhrase(hereMatch[1]), conf: 88 };
  }
  // "<NAME> — Invoice" (supplier bills)
  const dashMatch = text.match(
    /^([A-Z][\w'&\-]*(?:\s+[A-Z][\w'&\-]*){0,3})\s*[—\-–]\s*invoice/i,
  );
  if (dashMatch) {
    return { name: tidyPhrase(dashMatch[1]), conf: 93 };
  }
  // Fallback: leading capitalized phrase before a punctuation break.
  const leadingMatch = text.match(
    /^\s*([A-Z][\w'&\-]*(?:\s+[A-Z][\w'&\-]*){0,3})(?=[\s,.\-—:])/,
  );
  if (leadingMatch) {
    return { name: tidyPhrase(leadingMatch[1]), conf: 70 };
  }
  return null;
}

function findDateLike(text: string): { value: string; conf: number } | null {
  const iso = text.match(DATE_RE);
  if (iso) return { value: iso[1], conf: 95 };
  const wd = text.match(WEEKDAY_RE);
  if (wd) return { value: wd[1], conf: 78 };
  return null;
}

function extractLineChips(text: string, maxLines: number): AiPasteChip[] {
  const chips: AiPasteChip[] = [];
  const matches = Array.from(text.matchAll(LINE_RE));
  for (let i = 0; i < Math.min(matches.length, maxLines); i++) {
    const m = matches[i];
    const count = m[1];
    const unit = m[2].toLowerCase();
    const product = tidyPhrase(m[3]);
    if (!product) continue;
    chips.push({
      label: `${count} ${unit} ${product}`.slice(0, 48),
      field: `Line ${i + 1}`,
      conf: 88,
    });
  }
  return chips;
}

// ---------------------------------------------------------------------------
// Public: orders preview
//
// Order chips: customer · line 1 · line 2 · delivery date · pricing-hint
// ---------------------------------------------------------------------------

export function extractOrderPreviewChips(text: string): AiPasteChip[] {
  if (text.trim().length < 12) return [];
  const chips: AiPasteChip[] = [];

  const org = findOrgName(text);
  if (org) {
    chips.push({ label: org.name, field: "Customer", conf: org.conf });
  }

  chips.push(...extractLineChips(text, 3));

  const date = findDateLike(text);
  if (date) {
    chips.push({ label: date.value, field: "Delivery date", conf: date.conf });
  }

  if (/\busual\s+rates?\b|\bregular\s+pric/i.test(text)) {
    chips.push({ label: "usual rates", field: "Pricing", conf: 62 });
  } else if (/\$\d+\s*\/(?:lb|cs|case)\b/i.test(text)) {
    chips.push({ label: "explicit pricing", field: "Pricing", conf: 86 });
  }

  return chips.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Public: bills preview
//
// Bill chips: supplier · invoice # · date · line 1 · charge
// ---------------------------------------------------------------------------

export function extractBillPreviewChips(text: string): AiPasteChip[] {
  if (text.trim().length < 12) return [];
  const chips: AiPasteChip[] = [];

  const supplier = findOrgName(text);
  if (supplier) {
    chips.push({ label: supplier.name, field: "Supplier", conf: supplier.conf });
  }

  const invMatch = text.match(INVOICE_NUMBER_RE) ?? text.match(HASH_NUMBER_RE);
  if (invMatch) {
    chips.push({ label: `#${invMatch[1]}`, field: "Invoice #", conf: 95 });
  }

  const date = findDateLike(text);
  if (date) {
    chips.push({ label: date.value, field: "Invoice date", conf: date.conf });
  }

  // Bills are usually one line per supplier per visit — show up to 2.
  chips.push(...extractLineChips(text, 2));

  // Non-inventory charges (freight, fuel surcharge, etc.).
  const chargeMatch = Array.from(text.matchAll(CHARGE_RE))[0];
  if (chargeMatch) {
    const amount = chargeMatch[1] ?? chargeMatch[4] ?? "";
    const type = (chargeMatch[2] ?? chargeMatch[3] ?? "charge").toLowerCase();
    if (amount) {
      chips.push({
        label: `$${amount.replace(/^\$/, "")} ${type}`,
        field: "Non-inv. charge",
        conf: 90,
      });
    }
  }

  return chips.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Footer helper text for the composer footer ("5 fields detected · 4 will…")
// ---------------------------------------------------------------------------

export function buildFillsLabel(chips: AiPasteChip[]): string {
  if (chips.length === 0) return "Hit Parse and fill when you're ready.";
  const autofill = chips.filter(c => c.conf >= 70).length;
  const needsPick = chips.length - autofill;
  if (needsPick === 0) {
    return `${chips.length} field${chips.length === 1 ? "" : "s"} detected · all will autofill.`;
  }
  return `${chips.length} fields detected · ${autofill} will autofill, ${needsPick} needs your pick.`;
}
