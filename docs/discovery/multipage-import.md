# Discovery — multipage PDF supplier invoice import

**Scope:** A "multipage" PDF here means *one file containing multiple distinct invoices* (e.g. a supplier portal "month-end bundle"). It is **not** the same as a single invoice that physically spans 2+ pages; that case already works because every stage iterates pages and combines them into one invoice.

**Read-only audit.** No code changed. References are in `path:line` form so a future implementer can jump straight to the seams.

---

## 1. Current parsing assumptions about invoice count per PDF

### What exists

The entire pipeline assumes **one invoice per PDF**. The assumption surfaces in five places, in roughly the order data flows:

1. **Text extraction is flat concatenation across all pages.** [modules/distribution/supplier-invoices/services/extract-pdf-text.ts:78-164](modules/distribution/supplier-invoices/services/extract-pdf-text.ts:78) loops `for (let i = 1; i <= pdf.numPages; i++)`, builds a per-page string `--- Page ${i} ---\n${lines.join("\n")}`, and joins them with `"\n\n"` into a single `combinedText`. The `--- Page N ---` markers are the only signal that pages exist; nothing downstream treats them as invoice boundaries.

2. **Text-AI prompt frames the input as a single invoice.** [modules/distribution/supplier-invoices/utils/ai-prompts.ts:119-122](modules/distribution/supplier-invoices/utils/ai-prompts.ts:119):

   ```
   MULTI-PAGE INVOICES:
   - Combine line items from all pages in order.
   - Ignore repeated table header rows (DESCRIPTION, QUANTITY, WEIGHT, RATE, AMOUNT, etc.).
   - Page subtotals are NOT line items — ignore them.
   ```

   The user-message body wraps the entire text in `--- INVOICE TEXT ---` / `--- END INVOICE TEXT ---` ([modules/distribution/supplier-invoices/utils/ai-validation.ts:339-341](modules/distribution/supplier-invoices/utils/ai-validation.ts:339)). The JSON schema enforces a single invoice header (one `supplierName`, one `supplierInvoiceNumber`, one `invoiceDate`, one `totalAmount`, one `subtotal`) plus a single `lines: AiInvoiceLine[]` array ([modules/distribution/supplier-invoices/utils/ai-prompts.ts:129-153](modules/distribution/supplier-invoices/utils/ai-prompts.ts:129)).

3. **Vision prompt is identical in framing.** [modules/distribution/supplier-invoices/utils/vision-prompts.ts:80-83](modules/distribution/supplier-invoices/utils/vision-prompts.ts:80):

   ```
   MULTI-PAGE INVOICES:
   - Combine line items from ALL pages in order
   - Ignore repeated table header rows ...
   - Page subtotals are NOT line items — ignore them
   ```

   Same single-invoice JSON schema ([modules/distribution/supplier-invoices/utils/vision-prompts.ts:100-124](modules/distribution/supplier-invoices/utils/vision-prompts.ts:100)). The vision call also sends one PDF buffer wholesale ([modules/distribution/supplier-invoices/services/ai-provider-openai.ts:237-280](modules/distribution/supplier-invoices/services/ai-provider-openai.ts:237)).

4. **`PipelineResult` is singular.** [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:171-192](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:171) — one `prefillResult: SupplierInvoicePdfPrefillResult`, one confidence, one source, etc. `SupplierInvoicePdfPrefillResult` ([modules/distribution/supplier-invoices/utils/pdf-prefill.ts:38-45](modules/distribution/supplier-invoices/utils/pdf-prefill.ts:38)) has one `values` block with one `supplierInvoiceNumber`, one `invoiceDate`, and one `lines[]`.

5. **Reconciliation gate is single-invoice.** [modules/distribution/supplier-invoices/utils/pipeline-scoring.ts:39-51](modules/distribution/supplier-invoices/utils/pipeline-scoring.ts:39) reads `result.totalComparison.matches` — a single boolean comparing SUM(all line totals) to a single `extractedTotal`. The deterministic parser's `extractBalanceDue` ([modules/distribution/supplier-invoices/utils/pdf-prefill.ts:187-197](modules/distribution/supplier-invoices/utils/pdf-prefill.ts:187)) takes `Math.max` of every `$X.XX` it can match across the document text when an explicit "BALANCE DUE" / "TOTAL DUE" isn't found.

### What's missing or unclear

- No per-invoice or per-segment plural shape anywhere. Nothing in `AiExtractionResult`, `PipelineResult`, `SupplierInvoicePdfPrefillResult`, or the DB row admits multiple invoices in one file.
- Filename-based heuristics (`supplierCandidateFromFilename`, [modules/distribution/supplier-invoices/utils/pdf-prefill.ts:199-206](modules/distribution/supplier-invoices/utils/pdf-prefill.ts:199); `\bInv[_ -]?(\d{3,})\b` at line 172) all assume one invoice number per file.

### Quick observations

- **A bundle PDF fed to today's pipeline would mis-reconcile by construction.** Sum of all sub-invoice line totals would be matched against `Math.max(all dollar amounts)` — almost certainly the largest single invoice's grand total, not the sum. That guarantees `totalsMatch === false`, which (a) forces the speculative-vision branch and the full vision fallback ([modules/distribution/supplier-invoices/services/parsing-pipeline.ts:371-376](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:371)) and (b) burns budget without ever producing a correct result.
- **The text-AI prompt's "Combine line items from all pages" rule will actively collapse a bundle into one Frankenstein invoice** — that's the single biggest behavioural risk. Same applies to vision.
- **The 30K character / 75 product / 25 MB upload caps** ([modules/distribution/supplier-invoices/services/ai-provider.ts:241-248](modules/distribution/supplier-invoices/services/ai-provider.ts:241), [modules/distribution/supplier-invoices/services/pdf-prefill.ts:26](modules/distribution/supplier-invoices/services/pdf-prefill.ts:26)) are sized for a single invoice; a 12-invoice bundle is likely to clip text but probably stay under 25 MB.

---

## 2. Existing invoice boundary detection (or lack thereof)

### What exists

**Nothing.** Grep for `multipage`, `multi-invoice`, `multi_invoice`, `split`, `boundary`, `page break`, `pageBreak` across `modules/`, `db/`, `docs/`, `lib/`, `scripts/` produced only:

- `column boundary` in [modules/distribution/supplier-invoices/services/extract-pdf-text.ts:15](modules/distribution/supplier-invoices/services/extract-pdf-text.ts:15) (column-detection for table rows, unrelated).
- `HydrationBoundary` (React Query SSR, unrelated).
- The "MULTI-PAGE INVOICES" prompt sections in [ai-prompts.ts:119](modules/distribution/supplier-invoices/utils/ai-prompts.ts:119) and [vision-prompts.ts:80](modules/distribution/supplier-invoices/utils/vision-prompts.ts:80) — these explicitly tell the AI to **combine** pages, i.e. the opposite of splitting.
- A `multi-page invoice` test in [modules/distribution/supplier-invoices/utils/pipeline-scoring.test.ts:307-338](modules/distribution/supplier-invoices/utils/pipeline-scoring.test.ts:307) covering repeated table headers within one invoice (assertion: 2 lines, not 3, because the duplicate header row must be dropped). Confirms the singular-invoice assumption.
- A `pdfPageCount` parameter is threaded through ([modules/distribution/supplier-invoices/services/parsing-pipeline.ts:210, 335](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:210), [modules/distribution/supplier-invoices/utils/vision-dispatch.ts:16-34](modules/distribution/supplier-invoices/utils/vision-dispatch.ts:16)), but it is only used for (a) the scanned-PDF heuristic (chars-per-page) and (b) the speculative-vision dispatch heuristic. Never for boundary detection.

### `supplierImportProfiles.parsingRules` shape

[db/schema.ts:2166-2174](db/schema.ts:2166) defines:

```ts
parsingRules: jsonb("parsing_rules")
  .$type<{
    headerFields?: Record<string, string>;
    lineParsing?: Record<string, unknown>;
    exclusions?: string[];
    feePatterns?: string[];
    totalsPattern?: string;
  }>().notNull().default({}),
```

None of these are boundary markers, but the column is a flexible `jsonb` — a future build could add e.g. `invoiceBoundaryRegex` or `headerStartsWith` without a schema change. The TS shape in [modules/distribution/supplier-invoices/services/import-profiles.ts:12-18](modules/distribution/supplier-invoices/services/import-profiles.ts:12) would need to widen.

`detectImportProfile` ([modules/distribution/supplier-invoices/services/import-profiles.ts:172-224](modules/distribution/supplier-invoices/services/import-profiles.ts:172)) returns at most **one** profile per call — it doesn't even model "one profile per segment of the file".

### What's missing

- No commented-out code, no TODOs, no half-finished tests. This is a green field.

### Quick observations

- The `supplier_import_profiles` table is tenant + supplier scoped. For a bundle PDF the supplier is the same across all sub-invoices, so a per-supplier boundary rule is a natural fit. But: profile detection runs *after* the deterministic parse and matches against the *entire concatenated text* — for a bundle, the keyword check fires once on the whole thing.

---

## 3. End-to-end pipeline walkthrough

This is what fires from "PDF uploaded" to "ready for human review". Steps are sequential unless noted.

| # | Function | Where | Kind | What it does |
|---|---|---|---|---|
| 1 | `bulkImportSupplierInvoicesAction(formData)` or `parseSupplierInvoicePdfAction(formData)` | [modules/distribution/supplier-invoices/actions/index.ts:230, 253](modules/distribution/supplier-invoices/actions/index.ts:230) | server action | Auth + rate-limit + magic-byte validation; loops over the uploaded `File[]` (bulk) or processes one (single). Bulk caps at `BULK_IMPORT_MAX_FILES = 10` ([modules/distribution/supplier-invoices/services/bulk-import.ts:66](modules/distribution/supplier-invoices/services/bulk-import.ts:66)). |
| 2 | `bulkImportSupplierInvoices(files, args)` (bulk only) | [modules/distribution/supplier-invoices/services/bulk-import.ts:148-178](modules/distribution/supplier-invoices/services/bulk-import.ts:148) | server | Mints one `batchId` for the whole upload; processes files serially via `processOneFile`. **Each file → exactly one parse → exactly one `bulk_import_files` row.** |
| 3 | `parseSupplierInvoicePdf({ originalFilename, mimeType, bytes })` | [modules/distribution/supplier-invoices/services/pdf-prefill.ts:93-152](modules/distribution/supplier-invoices/services/pdf-prefill.ts:93) | server, hybrid | Tenant auth, mime/size guards (25 MB cap at line 26), then text extraction + a parallel `count(products)` to decide first-bill mode, then hands off to `runParsingPipeline`. Returns one `PipelineResult` per input file. |
| 4 | `extractTextForPipeline(bytes, mode)` | [modules/distribution/supplier-invoices/services/pdf-prefill.ts:45-82](modules/distribution/supplier-invoices/services/pdf-prefill.ts:45) | server, deterministic | When `PARSE_MODE=text-first`, calls `extractPdfText` (pdfjs-dist, layout-preserving with per-row bboxes); falls back to `pdf-parse` for the flat-text path. Output is the entire PDF's text + a page count. |
| 5 | `runParsingPipeline({ extractedText, extractedRows, … })` | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:198-596](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:198) | server, orchestrator | The whole AI/deterministic/vision dance. Substages below. |
| 5a | `detectScannedPdf(extractedText, pdfPageCount)` | [modules/distribution/supplier-invoices/utils/pipeline-scoring.ts:68-73](modules/distribution/supplier-invoices/utils/pipeline-scoring.ts:68) | deterministic | If chars/page < 50, returns the scanned-PDF empty result and bails. |
| 5b | Tenant data load: suppliers + products + category names | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:235-250](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:235) | DB | 3 queries in `Promise.all`. Enriched into `ProductMatchCandidate[]`. |
| 5c | `parseSupplierInvoicePdfText(args)` | [modules/distribution/supplier-invoices/utils/pdf-prefill.ts:675-749](modules/distribution/supplier-invoices/utils/pdf-prefill.ts:675) | deterministic | Regex-based extraction of supplier/header/lines/totals. Tries box-format → packed-format → generic-numeric. Returns `SupplierInvoicePdfPrefillResult` (one invoice). |
| 5d | `scoreParseResult(deterministicResult)` | [modules/distribution/supplier-invoices/utils/pipeline-scoring.ts:22-64](modules/distribution/supplier-invoices/utils/pipeline-scoring.ts:22) | deterministic | 0–100 score weighted across invoice#, date, supplier, lines extracted, totals match, unmatched product ratio. |
| 5e | `detectImportProfile({ tenantId, supplierId, extractedText, filename })` | [modules/distribution/supplier-invoices/services/import-profiles.ts:172-224](modules/distribution/supplier-invoices/services/import-profiles.ts:172) | DB + deterministic | If `supplierId` is known, returns the first active profile for that supplier. If not, scores profiles by `detectionKeywords` hit count against `extractedText.toUpperCase()` + filename. Returns one `ImportProfile \| null`. The profile's `confidenceThreshold` overrides the default 60 for the early-exit gate. |
| 5f | **Deterministic early-exit** | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:292-321](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:292) | branch | If `score >= threshold && linesExtracted && unmatchedProductRatio < 1` → `enrichWithAliases` (no AI) → return. |
| 5g | Speculative vision dispatch | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:330-355](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:330) | AI (concurrent) | When `shouldSpeculativelyDispatchVision` heuristic is true (sparse text per page, image-heavy PDF), starts the vision call **in parallel** with the text-AI call to save wall-clock. Result is awaited later only if `needsVision` ends up true. |
| 5h | `extractSupplierInvoiceWithAi(...)` | [modules/distribution/supplier-invoices/services/ai-extraction.ts:28-64](modules/distribution/supplier-invoices/services/ai-extraction.ts:28) → [ai-provider-openai.ts:99-156](modules/distribution/supplier-invoices/services/ai-provider-openai.ts:99) | AI (text) | OpenAI structured-output call with the full concatenated text. System prompt = `INVOICE_EXTRACTION_SYSTEM_PROMPT`. Returns one `AiExtractionResult`. |
| 5i | `mergeAiOverDeterministic(deterministic, aiResult, supplierRows)` | [modules/distribution/supplier-invoices/utils/ai-merge.ts](modules/distribution/supplier-invoices/utils/ai-merge.ts) | pure | Field-by-field merge giving AI precedence over deterministic. Returns `{ result, … }`. |
| 5j | `needsVision` gate + `extractSupplierInvoiceWithVision(...)` | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:371-438](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:371) → [ai-vision.ts:33-51](modules/distribution/supplier-invoices/services/ai-vision.ts:33) → [ai-provider-openai.ts:234-318](modules/distribution/supplier-invoices/services/ai-provider-openai.ts:234) | AI (vision) | Vision fires if `aiResult.lines.length === 0` OR `mergedBreakdown.totalsMatch === false` OR `score < 60`. PDF bytes sent inline as base64. System prompt = `VISION_INVOICE_EXTRACTION_SYSTEM_PROMPT`. **Note:** the `totalsMatch === false` trigger means a bundle PDF effectively always falls through to vision. |
| 5k | `correctVisionColumnSwap` → `scoreVisionExtraction` → `isVisionExtractionUseful` → conditional `mergeVisionOverResult` | [parsing-pipeline.ts:406-437](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:406) | pure + scoring | Decide whether vision result is "worth using" over the text-AI merge. |
| 5l | `enrichWithAliasesAndAiMatching(finalResult, tenantId, supplierId, candidateProducts, descriptions)` | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:744-802](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:744) | DB + AI (matching) | Runs `matchProductsMultiStage` with `useAiFallback: true`. Patches resolved line IDs back into the form result; collects `UnresolvedLine[]` with stage/confidence/top-candidates for the Review screen. |
| 5m | `matchProductsMultiStage({ vendorProductNames, candidateProducts, useAiFallback })` | [modules/distribution/supplier-invoices/services/product-matching.ts:191-312](modules/distribution/supplier-invoices/services/product-matching.ts:191) | hybrid | Stage 1 deterministic per name: exact alias → exact product name/SKU → fuzzy (score 60+) → low-confidence fuzzy (score 20-59) → unresolved. Stage 2 (if `useAiFallback && supplierId`): collects all `unresolved` names, pre-scores candidates with `selectTopCandidatesForMatching` (meat-domain signals), sends top N to `suggestProductMatches` (OpenAI), and writes back any `confidence >= 50` AI suggestions as `stage: "ai_suggested"` with `aiSuggestionPending: true`. |
| 5n | `suggestProductMatches(input)` | [modules/distribution/supplier-invoices/services/ai-extraction.ts:66-91](modules/distribution/supplier-invoices/services/ai-extraction.ts:66) → [ai-provider-openai.ts:158-232](modules/distribution/supplier-invoices/services/ai-provider-openai.ts:158) | AI (matching) | OpenAI call with the system prompt `PRODUCT_MATCH_SYSTEM_PROMPT`. Sees vendor names + enriched product candidates (with category + knownAliases). Post-call sanitises against the candidate ID allowlist ([ai-provider-openai.ts:216-230](modules/distribution/supplier-invoices/services/ai-provider-openai.ts:216)). |
| 5o | `detectPriceDeviations({ tenantId, supplierId, lines, productNames })` | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:822-889](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:822) | DB | For matched lines with a known supplier, pulls the most recent non-draft `supplier_invoice_lines.unitPrice` per product, returns deviations ≥5%. |
| 5p | `buildProposedProfile(finalResult, supplierRows)` | [modules/distribution/supplier-invoices/services/parsing-pipeline.ts:808-816](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:808) | pure | Builds detection keywords from matched supplier name + unmatched supplier candidates; surfaced as a one-click "save this profile" affordance when AI/vision confidence ≥ 70. |
| 6 | `createBulkImportFile(...)` (bulk only) | [modules/distribution/supplier-invoices/services/bulk-import-history.ts](modules/distribution/supplier-invoices/services/bulk-import-history.ts) | DB + R2 | Uploads PDF bytes to R2, inserts a `bulk_import_files` row with the frozen `PipelineResult` JSON in `pipeline_result`. **One row per input file.** |
| 7 | Client reads `bulk_import_files` → `ReviewQueueShell` → `ReviewContainer` → on submit, `createSupplierInvoiceAction` + optional `saveImportAliasesBatchAction` + `markBulkImportFileReviewedAction` | [components/review/review-queue-shell.tsx](modules/distribution/supplier-invoices/components/review/review-queue-shell.tsx), [components/review/review-container.tsx:302-467](modules/distribution/supplier-invoices/components/review/review-container.tsx:302) | UI + actions | Carousel of one card per `bulk_import_files` row. Each card = one bill. |

### What's missing or unclear

- The deterministic parser silently merges any "second invoice header" tokens into the supplier/header heuristics — e.g. multiple `Invoice #` occurrences would let the last match win at [modules/distribution/supplier-invoices/utils/pdf-prefill.ts:158-170](modules/distribution/supplier-invoices/utils/pdf-prefill.ts:158).
- No instrumentation distinguishes "AI returned 80 lines because it correctly read one big invoice" from "AI returned 80 lines because it spliced 8 invoices together". The first-line / debug telemetry ([parsing-pipeline.ts:552-575](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:552)) reports counts but not segment provenance.

---

## 4. Alias and matching tables

### Tables

**`supplier_product_aliases`** ([db/schema.ts:2203-2241](db/schema.ts:2203)) — vendor-line → catalog-product mapping per `(tenant, supplier)`.

| Column | Notes |
|---|---|
| `tenant_id`, `supplier_id` | FK; CASCADE delete |
| `vendor_product_name` | as printed on the invoice |
| `normalized_vendor_product_name` | output of `normalizeProductName` ([utils/normalization.ts](modules/distribution/supplier-invoices/utils/normalization.ts)) — used as the lookup key |
| `internal_product_id` | FK products; CASCADE delete |
| `confidence` | numeric(5,2), default `"100"` |
| `source` | enum `"manual" \| "ai_suggested" \| "confirmed" \| "parser"` |
| Unique index | `(tenant_id, supplier_id, normalized_vendor_product_name)` |

**`supplier_import_profiles`** ([db/schema.ts:2153-2201](db/schema.ts:2153)) — per `(tenant, supplier)` parsing config.

| Column | Notes |
|---|---|
| `profile_name` | unique per `(tenant, supplier)` |
| `detection_keywords` | jsonb string[] — used by `detectImportProfile` when supplier isn't known yet |
| `parser_type` | enum `"deterministic" \| "ai_fallback" \| "hybrid"` (declared, but never gated on in code — current pipeline always tries deterministic first regardless) |
| `parsing_rules` | flexible jsonb — see §2 above |
| `confidence_threshold` | overrides the default 60 for early-exit |
| `active` | boolean |

### How aliases get populated

| Source | Writer | Path |
|---|---|---|
| `manual` | `recordManualProductSelection` | [modules/distribution/supplier-invoices/services/product-matching.ts:456-468](modules/distribution/supplier-invoices/services/product-matching.ts:456) — confidence 100, source `"manual"` |
| `confirmed` | `saveConfirmedAiAlias` | [product-matching.ts:438-450](modules/distribution/supplier-invoices/services/product-matching.ts:438) — user accepted an AI suggestion |
| `manual` / `confirmed` (batch) | `saveImportAliasesBatchAction` | called from `ReviewContainer.submit` when the "Remember matches" checkbox is on ([components/review/review-container.tsx:398-417](modules/distribution/supplier-invoices/components/review/review-container.tsx:398)). Only writes for *manual* per-line overrides — parser-resolved lines don't need an alias write-through. |
| `parser` | (no writer found) | enum value declared in schema but no production code path writes it; reserved for future auto-learning. |
| `confirmAliasId` (status flip to confirmed) | `confirmProductAlias` | [product-matching.ts:123-142](modules/distribution/supplier-invoices/services/product-matching.ts:123) |

**Net:** today's pipeline learns aliases on every successful review-screen submit. There's no autonomous learning step; aliases are always behind a user click.

### Confidence surfacing

- `UnresolvedLine.confidence` (0–100) and `.stage` (`exact_alias`, `normalized_alias`, `exact_product`, `fuzzy_product`, `ai_suggested`, `unresolved`) propagate from `matchProductsMultiStage` to the Review screen.
- Header fields each have their own confidence via `FieldChip` chips ([components/review/header-card.tsx:35-121](modules/distribution/supplier-invoices/components/review/header-card.tsx:35)).
- Per-line UX badge: `Matched` or `Low-confidence match` with a `{score}% match` chip ([components/review/line-row.tsx:144-181](modules/distribution/supplier-invoices/components/review/line-row.tsx:144)).
- "No match found · Pick a product or create new" for unresolved lines ([line-row.tsx:183-196](modules/distribution/supplier-invoices/components/review/line-row.tsx:183)).

### Review UX for unmatched supplier / product

Review screen container: [components/review/review-container.tsx](modules/distribution/supplier-invoices/components/review/review-container.tsx).

- **Supplier:**
  - Combobox to pick from existing suppliers (line 522).
  - Click an unmatched-candidate chip → if name matches exactly, auto-selects; otherwise opens `CreateSupplierDialog` with the name pre-filled ([review-container.tsx:191-211](modules/distribution/supplier-invoices/components/review/review-container.tsx:191)).
- **Per line:**
  - `ProductPicker` combobox (search by name or SKU) ([components/review/product-picker.tsx:25-91](modules/distribution/supplier-invoices/components/review/product-picker.tsx:25)).
  - Top-candidate one-click chips when `topCandidates` is populated.
  - "Skip this line" marks it as a non-inventory fee/skip — excluded from submit payload but stays visually ([review-container.tsx:238-244, 314-336](modules/distribution/supplier-invoices/components/review/review-container.tsx:238)).
  - "Create new product" dialog (`CreateProductDialog`) with the raw vendor text pre-filled.
- **Remember matches checkbox** (defaults on, [review-container.tsx:145](modules/distribution/supplier-invoices/components/review/review-container.tsx:145)) controls whether confirmed picks save as aliases.

### What's missing / unclear

- `parser_type` (`deterministic \| ai_fallback \| hybrid`) is stored but never read — the pipeline runs the same fixed sequence regardless. A future build can re-use the column but would be writing into dead config today.
- `ImportProfile.parsingRules.lineParsing` (`Record<string, unknown>`) is a fully untyped jsonb escape hatch — flexible but no implementation reads from it.

---

## 5. Existing tests and fixtures

### PDF fixtures

**None committed.** `find . -name "*.pdf"` (outside `node_modules`/`.git`) returns zero results. The discovery hint was correct.

### Synthetic multi-page tests

One test uses a multi-page text fixture: [modules/distribution/supplier-invoices/utils/pipeline-scoring.test.ts:307-338](modules/distribution/supplier-invoices/utils/pipeline-scoring.test.ts:307).

```ts
const MULTI_PAGE_INVOICE = `
Invoice
Date
4/20/2026
Invoice #
999001
…
ItemDescriptionQtyQty/WeightRateAmount
RR Brisket Short RibBrisket Short Rib156.606.55370.73
ItemDescriptionQtyQty/WeightRateAmount      ← repeated header on page 2
RR RIB EYE1pc15.9012.80203.52
$574.25
`;
```

Assertion: `result.values.lines.length === 2` — **one** invoice with two lines, repeated header dropped. This is the *opposite* of multi-invoice; it explicitly enforces single-invoice-per-PDF.

Vision-scoring has analogous coverage at [utils/vision-scoring.test.ts:194-237](modules/distribution/supplier-invoices/utils/vision-scoring.test.ts:194) ("multi-page invoice with 20 lines scores well") — again, one invoice spanning multiple pages.

### Skipped / `.todo` tests

`grep -rn 'TODO\|\.skip\|\.todo' modules/distribution/supplier-invoices` returns only one production hit:

- [services/ai-provider.ts:254](modules/distribution/supplier-invoices/services/ai-provider.ts:254): `// TODO: add "anthropic", "gemini", "local" cases here as providers are implemented.`

No test is skipped or marked todo for multi-invoice or bundle handling.

### Quick observations

- All test text fixtures stay inline as TS template strings. A future build would need to keep that pattern (or admit binary fixtures) given the no-PDFs-committed convention.
- The test list is hard-coded in `package.json`'s `test:unit` script, per CLAUDE.md — any new multi-invoice test file would need to be added there to run in CI.

---

## 6. Loose hints elsewhere in the codebase

- **Bulk import is "many files, one invoice each".** [modules/distribution/supplier-invoices/services/bulk-import.ts:1-178](modules/distribution/supplier-invoices/services/bulk-import.ts:1) is explicit about this — each `BulkImportFileInput` produces one `BulkImportItemResult` (line 26-52) with one `pipelineResult`. The header comment (lines 12-18) says the user reviews every bill via the queue — no provision for "this file = N bills". `BULK_IMPORT_MAX_FILES = 10` is a hard cap.
- **Bulk landing client shape mirrors server.** [components/bulk-import-panel.tsx:23](modules/distribution/supplier-invoices/components/bulk-import-panel.tsx:23) `MAX_FILES_CLIENT_HINT = 10`; each `pending.file` is treated as one invoice for review.
- **`bulk_import_files.batch_id` already groups files**, and the review queue carousel groups by `batchId` ([db/schema.ts:2042-2043](db/schema.ts:2042), comment lines 1996-2002). A multipage build could re-use this mechanism by emitting N rows from one source file with the same `batchId`, but that requires either physically splitting the PDF into N R2 objects (each with a unique `object_key` per the `bulk_import_files_object_key_unique` constraint at [db/schema.ts:2034](db/schema.ts:2034)) or adding `(start_page, end_page)` columns + relaxing the unique constraint.
- **No plural shapes hiding in types.** `grep -rn 'ParsedInvoice\|invoices: Array\|invoices: \[\]' modules/` returns only references to `SalesInvoiceListItem` / `SupplierInvoiceListItem` (list-page paginated results, unrelated to parsing).
- **Supplier portal integration:** none found. The supplier-invoices flow only accepts user-uploaded PDFs through the file picker — there is no IMAP/email/portal-scraping ingestion path that might pre-aggregate. (Searched module + `lib/` + `app/`; nothing.)
- **Admin tooling:** no "split PDF" or "merge invoices" admin path. The bulk-import page is the only batch ingestion UI.
- **Seed data:** [db/seed.ts](db/seed.ts) does not create any bulk-import-files or import-profile rows that would hint at multi-invoice cases.

---

## Summary for scoping

### 1. Reuse

If a multipage PDF is split *upstream* of `runParsingPipeline` into N (text + bytes + page-range) segments, **almost everything downstream is reusable unchanged**:

- `runParsingPipeline` itself ([parsing-pipeline.ts:198](modules/distribution/supplier-invoices/services/parsing-pipeline.ts:198)) per segment.
- Deterministic parser, text-AI, vision, scoring, column-swap correction, merge logic — all already operate on a single "one invoice's text + bytes" blob.
- `enrichWithAliasesAndAiMatching` and `matchProductsMultiStage` are per-line and don't care about provenance.
- `detectPriceDeviations` and `buildProposedProfile` already key on `(tenantId, supplierId)` — they work per segment.
- The Review queue carousel is `bulk_import_files` rows grouped by `batchId`; N rows from one source file would just appear as a longer queue with the same batch.

What would need wrapping or extending:

- `extractPdfText` ([extract-pdf-text.ts:78](modules/distribution/supplier-invoices/services/extract-pdf-text.ts:78)) already iterates `pdf.numPages` — slicing per page is a one-line change; the harder part is choosing the page-grouping (boundary detection).
- `parseSupplierInvoicePdf` ([services/pdf-prefill.ts:93](modules/distribution/supplier-invoices/services/pdf-prefill.ts:93)) returns one `PipelineResult` today — would need to either return `PipelineResult[]` or accept a `pageRange` argument and be called N times by the boundary-aware wrapper.
- `bulkImportSupplierInvoices` ([services/bulk-import.ts:148](modules/distribution/supplier-invoices/services/bulk-import.ts:148)) loops over `BulkImportFileInput[]`; the cleanest fan-out point is inside `processOneFile` ([line 82](modules/distribution/supplier-invoices/services/bulk-import.ts:82)), which would call the wrapper and produce N `BulkImportItemResult` rows from one file.
- `bulk_import_files.object_key` is `UNIQUE` ([db/schema.ts:2034](db/schema.ts:2034)) — either suffix the key with a segment id, or add `start_page`/`end_page` columns and relax the constraint.

The AI prompts ([ai-prompts.ts:119-122](modules/distribution/supplier-invoices/utils/ai-prompts.ts:119), [vision-prompts.ts:80-83](modules/distribution/supplier-invoices/utils/vision-prompts.ts:80)) only need a tweak **if** a segment ever spans pages — the existing "combine all pages" rule is correct *within a segment* but actively harmful *across segments*. Splitting upstream means the existing prompt stays correct.

### 2. Smallest viable scope

The minimum-effort path is to **detect boundaries and split before `runParsingPipeline`**, then fan out to N segments through the existing single-invoice pipeline:

1. After `extractPdfText`, run a pure boundary detector over the per-page `combinedText` / `rows` arrays (start with a header-pattern heuristic like "page begins with `Invoice #` + a different number than previous page's"). Output: `Array<{ pageRange: [number, number]; text: string; rows: PdfRow[] }>`.
2. For each segment, build a per-segment `pdfBytes` slice (pdfjs-dist can write a subset; or for the text path, skip this and pass `pdfBytes: undefined`, which already disables vision — vision then becomes a stretch follow-up).
3. Call `runParsingPipeline` once per segment, accumulate `PipelineResult[]`.
4. From `processOneFile`, write one `bulk_import_files` row per segment (same `batchId`, `object_key` suffixed with segment index, `pipeline_result` per segment).
5. UI is unchanged — the queue carousel sees N rows, the user reviews each one.

If a single segment is the whole PDF (no boundary detected), the new path collapses to today's single-invoice behaviour. That gives a safe rollout — the boundary detector is the only new code that can regress.

### 3. Biggest unknown

**How to detect invoice boundaries reliably across heterogeneous supplier layouts.** Each plausible approach has a serious cost:

- **Header-pattern heuristic** (e.g. each invoice begins with a recognisable header block — "Invoice #" followed by a distinct number, a re-occurring supplier name/logo, a date that monotonically increases). Cheap, deterministic, easy to test — but brittle for portals that emit varied layouts, and effectively requires per-supplier rules (which lands you in `supplier_import_profiles.parsingRules` territory). Chicken-and-egg: a tenant ingests a bundle PDF *before* having a profile for that supplier.
- **Vision first-pass classifier** ("how many invoices are in this PDF, and what page ranges?"). Most accurate; doubles vision cost on every bundle upload. Could be gated behind a "this looks like a bundle" heuristic (e.g. text contains multiple distinct `Invoice #` strings) but that heuristic re-creates the boundary problem.
- **Ask the user to mark boundaries.** Lowest engineering cost, worst UX — and defeats the point of bulk import.
- **Constrain the feature to suppliers where we already have a profile**, and require the profile to carry a `boundaryPattern`. Clean, but limits day-one usefulness to tenants who have already curated profiles.

The decision here drives schema (do we extend `supplier_import_profiles.parsingRules` or add a new column?), cost model (per-bundle vision calls? per-segment?), and UX (does the user need to confirm the detected split before parsing fan-out?). It is the single hardest open question for a feature spec.
