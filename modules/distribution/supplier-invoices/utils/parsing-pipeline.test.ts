import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyAliasesToLines,
  applyMatchResultsToLines,
  buildProfileKeywords,
  collectPipelineErrorCodes,
  computePipelineParseStatus,
  countBlockingUnresolved,
  filterProducts,
  resolveAliasParams,
  type LineMatchEntry,
} from "./parsing-pipeline-logic";
import type { SupplierInvoicePdfPrefillLine } from "./pdf-prefill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLine(productId = ""): SupplierInvoicePdfPrefillLine {
  return {
    productId,
    unitType: "catch_weight",
    weightEntryMode: "total_weight",
    quantityCases: "1",
    weightLbs: "50",
    defaultCaseWeightLbs: "",
    caseWeightEntries: [""],
    unitPrice: "2.50",
    purchaseUnitAbbreviation: "",
    lotNumberOverride: "",
    expirationDateOverride: "",
  };
}

function makeMatch(productId: string, confidence = 90): LineMatchEntry {
  return { productId, confidence, aiSuggestionPending: false };
}

// ---------------------------------------------------------------------------
// C-1: applyAliasesToLines — alias assignment by sequential index
// ---------------------------------------------------------------------------

test("applyAliasesToLines: aliases for line 1 and line 3 only (not line 2)", () => {
  // 3 unmatched lines; aliases exist for descriptions at index 0 and 2.
  const lines = [makeLine(), makeLine(), makeLine()];
  const descs = ["CHICKEN TENDERS", "BEEF BRISKET", "LAMB RACK"];
  const aliasMap = new Map([
    ["chicken tender", "prod-A"],  // normalised key
    ["lamb rack", "prod-C"],
  ]);

  const result = applyAliasesToLines(lines, descs, aliasMap);

  assert.equal(result[0].productId, "prod-A", "line 0 should receive the alias for 'CHICKEN TENDERS'");
  assert.equal(result[1].productId, "",       "line 1 has no alias — should remain empty");
  assert.equal(result[2].productId, "prod-C", "line 2 should receive the alias for 'LAMB RACK'");
});

test("applyAliasesToLines: already-matched lines are skipped, index not consumed", () => {
  // Line 0 is already matched (productId present). Lines 1 and 2 are unmatched.
  // unmatchedDescs has 2 entries — one per unmatched line.
  const lines = [makeLine("existing-prod"), makeLine(), makeLine()];
  const descs = ["BEEF BRISKET", "LAMB RACK"];
  const aliasMap = new Map([
    ["beef brisket", "prod-B"],
    ["lamb rack", "prod-C"],
  ]);

  const result = applyAliasesToLines(lines, descs, aliasMap);

  assert.equal(result[0].productId, "existing-prod", "pre-matched line unchanged");
  assert.equal(result[1].productId, "prod-B", "line 1 (first unmatched) gets first desc");
  assert.equal(result[2].productId, "prod-C", "line 2 (second unmatched) gets second desc");
});

test("applyAliasesToLines: no aliases — all lines stay empty", () => {
  const lines = [makeLine(), makeLine(), makeLine()];
  const descs = ["A", "B", "C"];
  const aliasMap = new Map<string, string>();

  const result = applyAliasesToLines(lines, descs, aliasMap);
  assert.ok(result.every(l => l.productId === ""), "all lines stay unmatched");
});

test("applyAliasesToLines: aliases for all 3 lines", () => {
  const lines = [makeLine(), makeLine(), makeLine()];
  const descs = ["CHICKEN TENDERS", "BEEF BRISKET", "LAMB RACK"];
  const aliasMap = new Map([
    ["chicken tender", "prod-A"],
    ["beef brisket", "prod-B"],
    ["lamb rack", "prod-C"],
  ]);

  const result = applyAliasesToLines(lines, descs, aliasMap);
  assert.equal(result[0].productId, "prod-A");
  assert.equal(result[1].productId, "prod-B");
  assert.equal(result[2].productId, "prod-C");
});

test("applyAliasesToLines: numeric fields are preserved exactly", () => {
  const line = makeLine();
  line.weightLbs = "72.45";
  line.unitPrice = "3.25";
  line.quantityCases = "4";

  const result = applyAliasesToLines([line], ["CHICKEN TENDERS"], new Map([["chicken tender", "prod-A"]]));

  assert.equal(result[0].weightLbs, "72.45");
  assert.equal(result[0].unitPrice, "3.25");
  assert.equal(result[0].quantityCases, "4");
});

// ---------------------------------------------------------------------------
// C-2: applyMatchResultsToLines — match assignment by description, not first-available
// ---------------------------------------------------------------------------

test("applyMatchResultsToLines: 3 AI matches, each assigned to its own line by description", () => {
  const lines = [makeLine(), makeLine(), makeLine()];
  const descs = ["CHICKEN TENDERS", "BEEF BRISKET", "LAMB RACK"];
  const matchByName = new Map<string, LineMatchEntry>([
    ["CHICKEN TENDERS", makeMatch("prod-A")],
    ["BEEF BRISKET",    makeMatch("prod-B")],
    ["LAMB RACK",       makeMatch("prod-C")],
  ]);

  const { enrichedLines, stillUnmatched } = applyMatchResultsToLines(lines, descs, matchByName);

  assert.equal(enrichedLines[0].productId, "prod-A");
  assert.equal(enrichedLines[1].productId, "prod-B");
  assert.equal(enrichedLines[2].productId, "prod-C");
  assert.equal(stillUnmatched.length, 0, "all three descriptions resolved");
});

test("applyMatchResultsToLines: AI matches for lines 0 and 2 only", () => {
  const lines = [makeLine(), makeLine(), makeLine()];
  const descs = ["CHICKEN TENDERS", "BEEF BRISKET", "LAMB RACK"];
  const matchByName = new Map<string, LineMatchEntry>([
    ["CHICKEN TENDERS", makeMatch("prod-A")],
    // BEEF BRISKET intentionally absent
    ["LAMB RACK", makeMatch("prod-C")],
  ]);

  const { enrichedLines, stillUnmatched } = applyMatchResultsToLines(lines, descs, matchByName);

  assert.equal(enrichedLines[0].productId, "prod-A", "line 0 matched");
  assert.equal(enrichedLines[1].productId, "",       "line 1 stays unmatched — must not receive prod-C");
  assert.equal(enrichedLines[2].productId, "prod-C", "line 2 matched");
  assert.deepEqual(stillUnmatched, ["BEEF BRISKET"], "stillUnmatched contains exactly the unresolved description");
});

test("applyMatchResultsToLines: low-confidence match does not patch the line", () => {
  const lines = [makeLine()];
  const descs = ["MYSTERY ITEM"];
  const matchByName = new Map<string, LineMatchEntry>([
    ["MYSTERY ITEM", { productId: "prod-X", confidence: 40, aiSuggestionPending: false }],
  ]);

  const { enrichedLines, stillUnmatched } = applyMatchResultsToLines(lines, descs, matchByName);

  assert.equal(enrichedLines[0].productId, "", "low-confidence match must not be applied");
  assert.deepEqual(stillUnmatched, ["MYSTERY ITEM"]);
});

test("applyMatchResultsToLines: aiSuggestionPending=true with confidence>=60 IS auto-filled", () => {
  const lines = [makeLine()];
  const descs = ["CHICKEN BACK"];
  const matchByName = new Map<string, LineMatchEntry>([
    ["CHICKEN BACK", { productId: "prod-Y", confidence: 85, aiSuggestionPending: true }],
  ]);

  const { enrichedLines, stillUnmatched } = applyMatchResultsToLines(lines, descs, matchByName);

  assert.equal(enrichedLines[0].productId, "prod-Y", "high-confidence AI suggestion is pre-filled in the form");
  assert.deepEqual(stillUnmatched, [], "resolved by auto-fill, not in stillUnmatched");
});

test("applyMatchResultsToLines: aiSuggestionPending=true with confidence<60 is NOT auto-filled", () => {
  const lines = [makeLine()];
  const descs = ["MYSTERY PRODUCT"];
  const matchByName = new Map<string, LineMatchEntry>([
    ["MYSTERY PRODUCT", { productId: "prod-Z", confidence: 55, aiSuggestionPending: true }],
  ]);

  const { enrichedLines, stillUnmatched } = applyMatchResultsToLines(lines, descs, matchByName);

  assert.equal(enrichedLines[0].productId, "", "low-confidence AI suggestion must not be auto-filled");
  assert.deepEqual(stillUnmatched, ["MYSTERY PRODUCT"]);
});

test("applyMatchResultsToLines: mixed matched/unmatched input lines", () => {
  // line 0 already has a productId (matched by deterministic parser)
  // lines 1 and 2 are unmatched — only 2 descriptions in unmatchedDescs
  const lines = [makeLine("det-prod"), makeLine(), makeLine()];
  const descs = ["BEEF BRISKET", "LAMB RACK"];
  const matchByName = new Map<string, LineMatchEntry>([
    ["BEEF BRISKET", makeMatch("prod-B")],
    ["LAMB RACK",    makeMatch("prod-C")],
  ]);

  const { enrichedLines, stillUnmatched } = applyMatchResultsToLines(lines, descs, matchByName);

  assert.equal(enrichedLines[0].productId, "det-prod", "pre-matched line unchanged");
  assert.equal(enrichedLines[1].productId, "prod-B");
  assert.equal(enrichedLines[2].productId, "prod-C");
  assert.equal(stillUnmatched.length, 0);
});

test("applyMatchResultsToLines: stillUnmatched aligned with descriptions not descriptions by filtered index", () => {
  // Bug that was fixed: old code used enrichedLines.filter(no productId).map((_, i) => descs[i])
  // which mapped the i-th unresolved line to the i-th description, not the correct one.
  // This test catches that regression: only line 1 (BEEF BRISKET) is unresolved,
  // so stillUnmatched must be ["BEEF BRISKET"], not ["CHICKEN TENDERS"].
  const lines = [makeLine(), makeLine(), makeLine()];
  const descs = ["CHICKEN TENDERS", "BEEF BRISKET", "LAMB RACK"];
  const matchByName = new Map<string, LineMatchEntry>([
    ["CHICKEN TENDERS", makeMatch("prod-A")],
    // BEEF BRISKET has no match entry
    ["LAMB RACK", makeMatch("prod-C")],
  ]);

  const { stillUnmatched } = applyMatchResultsToLines(lines, descs, matchByName);

  assert.deepEqual(stillUnmatched, ["BEEF BRISKET"],
    "stillUnmatched must contain the description for the line with no match, not the first description");
});

// ---------------------------------------------------------------------------
// buildProfileKeywords — profile detection keyword generation
// ---------------------------------------------------------------------------

test("buildProfileKeywords: known supplier produces non-empty stable keywords", () => {
  const kws = buildProfileKeywords("SUMMIT TRADING", []);
  assert.ok(kws.length > 0, "keywords must not be empty for a matched supplier");
  assert.ok(kws.every(k => k.length >= 4), "all keyword tokens must be >= 4 chars");
  assert.ok(kws.includes("SUMMIT"), "supplier name token 'SUMMIT' should be included");
  assert.ok(kws.includes("TRADING"), "supplier name token 'TRADING' should be included");
});

test("buildProfileKeywords: supplier name takes priority over candidate text", () => {
  const kws = buildProfileKeywords("ZABIHA HALAL", ["SOME RANDOM TEXT ABOUT STUFF"]);
  assert.equal(kws[0], "ZABIHA", "first keyword must come from supplier name");
  assert.equal(kws[1], "HALAL", "second keyword must come from supplier name");
});

test("buildProfileKeywords: falls back to candidate text when supplier name is absent", () => {
  const kws = buildProfileKeywords(undefined, ["ALI TRADERS COMPANY"]);
  assert.ok(kws.length > 0, "should still produce keywords from candidate text");
  assert.ok(kws.includes("TRADERS"), "candidate token 'TRADERS' should be included");
});

test("buildProfileKeywords: empty supplier name and no candidates yields empty keywords", () => {
  const kws = buildProfileKeywords(undefined, []);
  assert.equal(kws.length, 0, "no data → no keywords");
});

test("buildProfileKeywords: deduplicates tokens that appear in both supplier name and candidates", () => {
  const kws = buildProfileKeywords("SUMMIT TRADING", ["SUMMIT TRADING COMPANY"]);
  const summits = kws.filter(k => k === "SUMMIT");
  assert.equal(summits.length, 1, "SUMMIT must not appear twice");
  const tradings = kws.filter(k => k === "TRADING");
  assert.equal(tradings.length, 1, "TRADING must not appear twice");
});

test("buildProfileKeywords: caps output at 5 tokens", () => {
  const kws = buildProfileKeywords("ALPHA BETA GAMMA DELTA EPSILON ZETA THETA", []);
  assert.ok(kws.length <= 5, "must never exceed 5 keywords");
});

test("buildProfileKeywords: short tokens (< 4 chars) are excluded", () => {
  // "ALI" is 3 chars, "AB" is 2 chars — neither should appear
  const kws = buildProfileKeywords("ALI AB TRADERS", []);
  assert.ok(!kws.includes("ALI"), "3-char token 'ALI' must be excluded");
  assert.ok(!kws.includes("AB"), "2-char token 'AB' must be excluded");
  assert.ok(kws.includes("TRADERS"), "'TRADERS' (7 chars) must be included");
});

// ---------------------------------------------------------------------------
// Token usage must not appear in user-facing warnings (Phase 2 fix)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 4: resolveAliasParams — alias intent for each row action
// ---------------------------------------------------------------------------

const SUPPLIER_ID = "supplier-abc";
const VENDOR_NAME = "JUMBO CHICKEN TENDER";
const SUGGESTED_ID = "prod-suggested";
const CHOSEN_ID = "prod-chosen";

test("resolveAliasParams: accept action saves a confirmed alias", () => {
  const result = resolveAliasParams("accept", SUPPLIER_ID, VENDOR_NAME, SUGGESTED_ID, "");
  assert.equal(result.save, true);
  if (!result.save) return;
  assert.equal(result.source, "confirmed", "accepted AI suggestion must use source='confirmed'");
  assert.equal(result.internalProductId, SUGGESTED_ID);
  assert.equal(result.supplierId, SUPPLIER_ID);
  assert.equal(result.vendorProductName, VENDOR_NAME);
});

test("resolveAliasParams: choose action saves a manual alias", () => {
  const result = resolveAliasParams("choose", SUPPLIER_ID, VENDOR_NAME, SUGGESTED_ID, CHOSEN_ID);
  assert.equal(result.save, true);
  if (!result.save) return;
  assert.equal(result.source, "manual", "manual product selection must use source='manual'");
  assert.equal(result.internalProductId, CHOSEN_ID, "chosenProductId overrides suggestedProductId");
});

test("resolveAliasParams: ignore action does not save an alias", () => {
  const result = resolveAliasParams("ignore", SUPPLIER_ID, VENDOR_NAME, SUGGESTED_ID, "");
  assert.equal(result.save, false, "ignored row must never save an alias");
});

test("resolveAliasParams: ignore with a chosen product still does not save", () => {
  const result = resolveAliasParams("ignore", SUPPLIER_ID, VENDOR_NAME, SUGGESTED_ID, CHOSEN_ID);
  assert.equal(result.save, false, "chosen product is irrelevant once the user ignores the row");
});

test("resolveAliasParams: null supplierId never saves regardless of action", () => {
  const accept = resolveAliasParams("accept", null, VENDOR_NAME, SUGGESTED_ID, "");
  const choose = resolveAliasParams("choose", null, VENDOR_NAME, null, CHOSEN_ID);
  assert.equal(accept.save, false, "null supplierId must block accept alias save");
  assert.equal(choose.save, false, "null supplierId must block choose alias save");
});

test("resolveAliasParams: accept with null suggestedProductId does not save", () => {
  const result = resolveAliasParams("accept", SUPPLIER_ID, VENDOR_NAME, null, "");
  assert.equal(result.save, false, "accept without a suggested product must not save");
});

test("resolveAliasParams: choose with empty chosenProductId does not save", () => {
  const result = resolveAliasParams("choose", SUPPLIER_ID, VENDOR_NAME, SUGGESTED_ID, "");
  assert.equal(result.save, false, "choose without a selected product must not save");
});

// ---------------------------------------------------------------------------
// Phase 4: countBlockingUnresolved — submit safety
// ---------------------------------------------------------------------------

test("countBlockingUnresolved: zero actionable rows is never blocking", () => {
  assert.equal(countBlockingUnresolved(0, 0, 0), 0);
});

test("countBlockingUnresolved: all rows resolved — not blocking", () => {
  assert.equal(countBlockingUnresolved(3, 3, 0), 0);
});

test("countBlockingUnresolved: all rows ignored — not blocking (user consciously skipped)", () => {
  assert.equal(countBlockingUnresolved(3, 0, 3), 0,
    "all-ignored should yield 0 blocking rows (though form submit may still fail due to schema)");
});

test("countBlockingUnresolved: mix of resolved and ignored — not blocking", () => {
  assert.equal(countBlockingUnresolved(4, 2, 2), 0);
});

test("countBlockingUnresolved: some rows still pending", () => {
  assert.equal(countBlockingUnresolved(5, 2, 1), 2, "5 - 2 resolved - 1 ignored = 2 still pending");
});

test("countBlockingUnresolved: resolved + ignored cannot exceed actionable (clamped to 0)", () => {
  assert.equal(countBlockingUnresolved(2, 3, 1), 0, "must clamp at 0, not go negative");
});

// ---------------------------------------------------------------------------
// Phase 4: profile keywords stability (regression for known supplier)
// ---------------------------------------------------------------------------

test("buildProfileKeywords: known supplier keywords are stable regardless of unmatched candidates", () => {
  const kwsA = buildProfileKeywords("SUMMIT TRADING", ["SOME CANDIDATE TEXT"]);
  const kwsB = buildProfileKeywords("SUMMIT TRADING", ["COMPLETELY DIFFERENT WORDS HERE"]);
  assert.equal(kwsA[0], kwsB[0], "first keyword must always come from supplier name 'SUMMIT'");
  assert.equal(kwsA[1], kwsB[1], "second keyword must always come from supplier name 'TRADING'");
});

test("buildProfileKeywords: unmatched candidates extend but do not replace supplier name tokens", () => {
  const kws = buildProfileKeywords("SUMMIT TRADING", ["EXTRA WORDS FOR TESTING"]);
  assert.ok(kws.includes("SUMMIT"), "supplier token SUMMIT must be present");
  assert.ok(kws.includes("TRADING"), "supplier token TRADING must be present");
  assert.ok(kws.indexOf("SUMMIT") < kws.indexOf("EXTRA"), "supplier tokens must precede candidate tokens");
});

// ---------------------------------------------------------------------------
// filterProducts — searchable product combobox filtering
// ---------------------------------------------------------------------------

const PRODUCTS = [
  { id: "p1", name: "Jumbo Chicken Tender", sku: "CHK-01" },
  { id: "p2", name: "Chicken Breast Boneless", sku: "CHK-02" },
  { id: "p3", name: "Lamb Rack", sku: "LMB-01" },
  { id: "p4", name: "Beef Brisket Short Rib", sku: null },
];

test("filterProducts: empty query returns all products unchanged", () => {
  const result = filterProducts(PRODUCTS, "");
  assert.equal(result.length, PRODUCTS.length, "empty query must return all products");
  assert.strictEqual(result, PRODUCTS as typeof result, "same reference — no copy for empty query");
});

test("filterProducts: whitespace-only query returns all products", () => {
  const result = filterProducts(PRODUCTS, "   ");
  assert.equal(result.length, PRODUCTS.length);
});

test("filterProducts: matches by name (case-insensitive)", () => {
  const result = filterProducts(PRODUCTS, "chicken");
  assert.equal(result.length, 2, "should match both chicken products");
  assert.ok(result.some(p => p.id === "p1"), "Jumbo Chicken Tender matched");
  assert.ok(result.some(p => p.id === "p2"), "Chicken Breast Boneless matched");
});

test("filterProducts: matches by SKU (case-insensitive)", () => {
  const result = filterProducts(PRODUCTS, "lmb");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "p3");
});

test("filterProducts: null SKU does not throw and does not match query", () => {
  const result = filterProducts(PRODUCTS, "null");
  assert.equal(result.length, 0, "null SKU must not match the string 'null'");
});

test("filterProducts: no match returns empty array", () => {
  const result = filterProducts(PRODUCTS, "xyzzy");
  assert.equal(result.length, 0);
});

test("filterProducts: partial SKU match works", () => {
  const result = filterProducts(PRODUCTS, "CHK-02");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "p2");
});

test("filterProducts: preserves full type of input items", () => {
  const result = filterProducts(PRODUCTS, "lamb");
  assert.equal(result[0].sku, "LMB-01", "sku field preserved");
});

// ---------------------------------------------------------------------------
test("pipeline warnings must not contain token usage strings", () => {
  // These were the two strings previously appended to warnings[]:
  //   "OpenAI tokens used: N (prompt: N, completion: N)"
  //   "Vision tokens: N (prompt: N, completion: N)"
  // Neither should appear in user-facing warnings after Phase 2.
  const oldOpenAiFormat = /OpenAI tokens used:\s*\d+/i;
  const oldVisionFormat = /Vision tokens:\s*\d+/i;

  const legitimateWarnings = [
    "AI extraction was used — review all fields before saving.",
    "Weight column could not be recovered from this PDF — all line weights are 0.",
    "Non-inventory fees detected by AI: Fuel Surcharge.",
    "Vision-based table extraction used — 11 row(s) extracted visually.",
  ];
  for (const w of legitimateWarnings) {
    assert.ok(!oldOpenAiFormat.test(w), `Legitimate warning must not match old OpenAI token pattern: "${w}"`);
    assert.ok(!oldVisionFormat.test(w), `Legitimate warning must not match old vision token pattern: "${w}"`);
  }

  // Sanity: the patterns DO match the previously offending strings
  assert.ok(oldOpenAiFormat.test("OpenAI tokens used: 1234 (prompt: 1000, completion: 234)"),
    "pattern must detect the old OpenAI token string");
  assert.ok(oldVisionFormat.test("Vision tokens: 500 (prompt: 400, completion: 100)"),
    "pattern must detect the old vision token string");
});

// ---------------------------------------------------------------------------
// computePipelineParseStatus / collectPipelineErrorCodes
//
// The pipeline calls these to decide whether the resulting bulk_import_files
// row goes in as `'parsed'` (reviewable) or `'parse_error'` (re-upload) —
// see runParsingPipeline in services/parsing-pipeline.ts. These tests pin
// the exact rules so the boundary doesn't drift.
// ---------------------------------------------------------------------------

test("computePipelineParseStatus: ai success + no vision attempt → success", () => {
  const status = computePipelineParseStatus({
    aiStatus: "success",
    visionAttempted: false,
    visionStatus: null,
    visionUsefullyApplied: false,
    realDeterministicLineCount: 0,
  });
  assert.equal(status, "success");
});

test("computePipelineParseStatus: ai failed + vision not attempted + no det lines → parse_error", () => {
  // This is the exact multipage 0-lines symptom from the bulk-import bug.
  const status = computePipelineParseStatus({
    aiStatus: "failed",
    visionAttempted: false,
    visionStatus: null,
    visionUsefullyApplied: false,
    realDeterministicLineCount: 0,
  });
  assert.equal(status, "parse_error");
});

test("computePipelineParseStatus: ai failed + vision failed + no det lines → parse_error", () => {
  const status = computePipelineParseStatus({
    aiStatus: "failed",
    visionAttempted: true,
    visionStatus: "failed",
    visionUsefullyApplied: false,
    realDeterministicLineCount: 0,
  });
  assert.equal(status, "parse_error");
});

test("computePipelineParseStatus: ai failed + vision succeeded + usefully applied → partial_success", () => {
  const status = computePipelineParseStatus({
    aiStatus: "failed",
    visionAttempted: true,
    visionStatus: "success",
    visionUsefullyApplied: true,
    realDeterministicLineCount: 0,
  });
  assert.equal(status, "partial_success");
});

test("computePipelineParseStatus: ai failed + det parsed 5 real lines → partial_success", () => {
  // Failure is real but the deterministic stage carried us — surface the
  // failure code for telemetry but let the row stay reviewable.
  const status = computePipelineParseStatus({
    aiStatus: "failed",
    visionAttempted: false,
    visionStatus: null,
    visionUsefullyApplied: false,
    realDeterministicLineCount: 5,
  });
  assert.equal(status, "partial_success");
});

test("computePipelineParseStatus: ai failed + 1 det real line still tips to parse_error", () => {
  // Threshold is < 2 — a single line on its own isn't enough to call this
  // a usable parse.
  const status = computePipelineParseStatus({
    aiStatus: "failed",
    visionAttempted: false,
    visionStatus: null,
    visionUsefullyApplied: false,
    realDeterministicLineCount: 1,
  });
  assert.equal(status, "parse_error");
});

test("collectPipelineErrorCodes: empty when no errors", () => {
  const codes = collectPipelineErrorCodes({
    aiErrorCode: null,
    visionAttempted: false,
    visionErrorCode: null,
  });
  assert.deepEqual(codes, []);
});

test("collectPipelineErrorCodes: ai error only, vision not attempted", () => {
  const codes = collectPipelineErrorCodes({
    aiErrorCode: "connection",
    visionAttempted: false,
    visionErrorCode: "timeout",
  });
  // Vision wasn't attempted, so its code is ignored even if non-null.
  assert.deepEqual(codes, ["connection"]);
});

test("collectPipelineErrorCodes: ai + vision both errored when attempted", () => {
  const codes = collectPipelineErrorCodes({
    aiErrorCode: "connection",
    visionAttempted: true,
    visionErrorCode: "timeout",
  });
  assert.deepEqual(codes, ["connection", "timeout"]);
});
