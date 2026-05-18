"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useProducts } from "@/modules/distribution/products/hooks/use-products";
import { useSuppliers } from "@/modules/distribution/suppliers/hooks/use-suppliers";

import { useSupplierCostDiffContext } from "../../hooks/use-supplier-invoices";
import { supplierInvoiceLineCostPerLb } from "../../utils/cost";

import { CreateProductDialog } from "../create-product-dialog";
import { CreateSupplierDialog } from "../create-supplier-dialog";

import {
  createSupplierInvoiceAction,
  findExistingSupplierInvoicesAction,
  markBulkImportFileReviewedAction,
  saveImportAliasesBatchAction,
  uploadSupplierInvoiceAttachmentAction,
} from "../../actions";
import type { PipelineResult } from "../../services/parsing-pipeline";

import {
  emptyChargeDraft,
  resolveChargesSubmit,
  type ChargeDraft,
  type SupplierInvoiceChargeType,
} from "./charges-panel";
import {
  ackKey as buildCostAckKey,
  type LineCostAckKey,
} from "./line-cost-diff-banner";
import {
  emptyLineLotExpiryState,
  resolveLineLotExpirySubmit,
  type LineLotExpiryState,
} from "./line-lot-expiry-editor";
import {
  initialLineWeightState,
  resolveLineWeightSubmit,
  type LineWeightState,
} from "./line-weight-editor";
import {
  mapPipelineToLineBboxes,
  mapPipelineToReviewData,
  type ProductLookup,
  type SupplierLookup,
} from "./map-pipeline-to-review-data";
import { ReviewScreen } from "./review-screen";
import type {
  ParsedLine,
  PaymentMethod,
  ProductCandidate,
  ReviewCounts,
  SupplierCandidate,
} from "./types";

/** Custom event the queue shell dispatches when the user clicks the
 *  page-header "Complete & next" button. ReviewContainer listens for this
 *  so the form's submit logic stays encapsulated here. */
const QUEUE_COMPLETE_EVENT = "review-queue:complete";

/**
 * Threads a real `PipelineResult` (loaded by the caller from localStorage or
 * IndexedDB) through the new Review screen. Owns the editable state — supplier
 * override, per-line product selection, skipped lines — and posts the final
 * draft via `createSupplierInvoiceAction`.
 *
 * Phase 5a scope:
 * - Header fields editable inline; supplier candidates clickable to fill.
 * - Line product candidates clickable; "Skip this line" marks a line as
 *   ignored locally (those lines are excluded from the submit payload).
 * - Submit creates a draft supplier invoice with `complete=false`. Posting to
 *   inventory (`complete=true`) requires a few more validations we punt on
 *   until phase 5b.
 *
 * Out of scope here (tracked as follow-ups):
 * - Supplier / product autocomplete search.
 * - Inline "Create supplier" / "Create new product" modals.
 * - Persisting the remember-aliases checkbox to per-supplier aliases.
 */
export function ReviewContainer({
  fileName,
  fileSize,
  pages,
  pipelineResult,
  pdfFile,
  pdfLoadError,
  bulkImportKey,
  topSlot,
  headerSlot,
  pdfPaneAccessory,
  paneEnterDirection,
  onSubmitStart,
  onSubmitEnd,
  onSubmitSuccess,
}: {
  fileName: string;
  fileSize?: string;
  pages?: number;
  pipelineResult: PipelineResult;
  /** Original PDF bytes from the bulk-import handoff, if any. */
  pdfFile?: Blob | null;
  /**
   * True when the host's PDF fetch failed irrecoverably. Forwarded to
   * PdfPane so it surfaces an explicit error card instead of a permanent
   * loading skeleton — the user should not review against a missing source.
   */
  pdfLoadError?: boolean;
  /**
   * Optional localStorage key the parse was loaded from. When set, a successful
   * submit marks the corresponding entry as `reviewed` so the bulk-landing
   * row flips to the "Reviewed" status pill without a manual reload.
   */
  bulkImportKey?: string | null;
  /** Queue-mode pass-through slots — see ReviewScreen for details. */
  topSlot?: ReactNode;
  headerSlot?:
    | ReactNode
    | ((args: { counts: ReviewCounts; submitDisabled: boolean }) => ReactNode);
  pdfPaneAccessory?: ReactNode;
  paneEnterDirection?: "next" | "prev";
  /**
   * Queue-mode lifecycle hooks. The shell uses these to drive the page
   * header's submitting-spinner state and to fire the completion animation
   * once the bill is actually posted. When ALL three are omitted (default
   * single-PDF path), submit routes to the bill detail page on success.
   */
  onSubmitStart?: () => void;
  onSubmitEnd?: () => void;
  onSubmitSuccess?: (args: { supplierInvoiceId: string }) => void;
}) {
  const router = useRouter();
  const productsQuery = useProducts();
  const suppliersQuery = useSuppliers();

  const products: ProductLookup[] = useMemo(
    () =>
      (productsQuery.data ?? []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
      })),
    [productsQuery.data],
  );

  const suppliers: SupplierLookup[] = useMemo(
    () =>
      (suppliersQuery.data ?? []).map(s => ({ id: s.id, name: s.name })),
    [suppliersQuery.data],
  );
  const baseData = useMemo(
    () =>
      mapPipelineToReviewData({
        fileName,
        pipeline: pipelineResult,
        products,
        suppliers,
        fileSize,
        pages,
      }),
    [fileName, fileSize, pages, pipelineResult, products, suppliers],
  );

  // Editable overlay on top of `baseData`. We keep the original mapped data
  // intact so a future "Reset" affordance can come for free, and so the
  // active-line state isn't disturbed when the user picks a candidate.
  const [supplierIdOverride, setSupplierIdOverride] = useState<string | null>(
    pipelineResult.prefillResult.values.supplierId || null,
  );
  const [supplierNameOverride, setSupplierNameOverride] = useState<string | null>(null);
  // Payment-method override — initialised from the parser's prefill so a
  // confidently-detected method (e.g. "Paid by ACH" in the PDF text) is the
  // default. The user can change it to any other method or back to "Not
  // specified" (null) before submit.
  const [paymentMethodOverride, setPaymentMethodOverride] = useState<
    PaymentMethod | null
  >(
    (pipelineResult.prefillResult.values.paymentMethod as PaymentMethod | null) ?? null,
  );
  // Bill-level notes — seeded from the parser's prefill so any PO #,
  // delivery instructions, or other free-text the parser pulled from
  // the PDF show up as the default. Empty string maps to null at submit.
  const [notesOverride, setNotesOverride] = useState<string>(
    pipelineResult.prefillResult.values.notes ?? "",
  );
  const [lineProductOverrides, setLineProductOverrides] = useState<
    Record<number, { productId: string; productName: string; sku: string | null }>
  >({});
  // Per-line weight override state. Missing key = use the parser's
  // resolved weight as-is. Setting a key persists the user's choice of
  // mode + per-case entries, even after the tray is collapsed.
  const [lineWeightStates, setLineWeightStates] = useState<
    Record<number, LineWeightState | undefined>
  >({});
  // Which lines have the weight editor visually expanded. Kept separate
  // from `lineWeightStates` so toggling open doesn't accidentally mark
  // a line as overridden (and vice versa).
  const [openWeightEditorLines, setOpenWeightEditorLines] = useState<
    Set<number>
  >(new Set());
  // Per-line cost-change acknowledgements. Keyed by
  // `(productId, supplierId, newCostPerLb)` so the ack survives unrelated
  // edits (e.g. weight change) as long as the triple stays the same;
  // changing the unit price would shift `newCostPerLb` and naturally
  // invalidate the ack.
  const [acknowledgedCostKeys, setAcknowledgedCostKeys] = useState<
    Set<LineCostAckKey>
  >(new Set());
  // Per-line lot # / expiration-date overrides. Same two-slice pattern
  // as weights — having the tray open doesn't imply an override, and
  // the override survives the tray being closed.
  const [lineLotExpiryStates, setLineLotExpiryStates] = useState<
    Record<number, LineLotExpiryState | undefined>
  >({});
  const [openLotExpiryEditorLines, setOpenLotExpiryEditorLines] = useState<
    Set<number>
  >(new Set());

  // Lines the user has explicitly removed from the bill. Filtered out of
  // both the rendered list (via ReviewScreen) and the submit payload —
  // the user can restore all in one click from the footer notice.
  const [deletedLineIds, setDeletedLineIds] = useState<Set<number>>(
    new Set(),
  );

  // Per-line case-count overrides. Parser quantity is often correct but
  // occasionally mis-reads (e.g. "1B" parsed as 18, or two adjacent
  // columns merged). Letting the reviewer fix the cases count directly
  // on the line — instead of having to delete + recreate — saves a lot
  // of cleanup work. Missing key = use the parser's value as-is.
  const [lineCasesOverrides, setLineCasesOverrides] = useState<
    Record<number, number>
  >({});

  // Editable charges, seeded from the parser's detected fees. Replaces
  // the previous silent-stamp behavior where every detected fee went to
  // the server as `chargeType: "other"`. The user can reclassify, edit
  // amounts, mark in-cost, or add/remove charges before submit.
  const [charges, setCharges] = useState<ChargeDraft[]>(() =>
    pipelineResult.detectedFees.map(fee => ({
      ...emptyChargeDraft(),
      description: fee.description,
      chargeType:
        (fee.category as SupplierInvoiceChargeType | null) ?? "other",
      amount: String(fee.amount ?? ""),
    })),
  );
  const [skippedLines, setSkippedLines] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  /** Which line is opening the Create Product dialog, or null when closed. */
  const [createProductForLine, setCreateProductForLine] = useState<number | null>(null);
  const [rememberAliases, setRememberAliases] = useState(true);

  const enriched = useMemo(() => {
    return enrichData({
      baseData,
      supplierNameOverride,
      lineProductOverrides,
      lineCasesOverrides,
      skippedLines,
    });
  }, [
    baseData,
    supplierNameOverride,
    lineProductOverrides,
    lineCasesOverrides,
    skippedLines,
  ]);

  // Duplicate-invoice lookup. Runs whenever both the selected supplier and
  // the parsed invoice number are known — re-runs automatically when the
  // user changes the supplier in the picker, since `supplierIdOverride` is
  // part of the query key. Returns matching posted bills so the Review
  // header can warn before the user re-posts a vendor invoice we've
  // already saved. The action checks invoice number first (strong signal);
  // when no number is present, it falls back to (date, total) which catches
  // re-uploads where the AI didn't read the number reliably.
  const parsedInvoiceNumber = (
    pipelineResult.prefillResult.values.supplierInvoiceNumber ?? ""
  ).trim();
  const parsedInvoiceDate = (
    pipelineResult.prefillResult.values.invoiceDate ?? ""
  ).trim();
  const parsedTotalAmount =
    pipelineResult.prefillResult.totalComparison?.extractedTotal ?? null;
  const duplicateQuery = useQuery({
    queryKey: [
      "supplier-invoices",
      "duplicates",
      supplierIdOverride,
      parsedInvoiceNumber,
      parsedInvoiceDate,
      parsedTotalAmount,
    ] as const,
    queryFn: () =>
      findExistingSupplierInvoicesAction({
        supplierId: supplierIdOverride!,
        supplierInvoiceNumber: parsedInvoiceNumber,
        invoiceDate: parsedInvoiceDate || null,
        totalAmount: parsedTotalAmount,
      }),
    // Run when EITHER the invoice number is present OR we have date+total to
    // soft-match on — both paths produce useful warnings.
    enabled: Boolean(
      supplierIdOverride &&
        (parsedInvoiceNumber.length > 0 ||
          (parsedInvoiceDate.length > 0 && parsedTotalAmount != null)),
    ),
    staleTime: 60_000,
  });
  const duplicateMatches = duplicateQuery.data ?? [];

  // Block-on-duplicate: when a posted (non-draft) duplicate exists, the user
  // must explicitly acknowledge before submit goes through. Drafts don't
  // trigger the block — the user might legitimately want to replace a stale
  // draft with this parse.
  const hasPostedDuplicate = duplicateMatches.some(m => m.status !== "draft");
  // Key the ack on the *content* of the duplicate set (sorted ids). When the
  // set changes — user switched supplier, new server data — the key changes
  // and the ack auto-resets without a setState-in-effect. The previous ack
  // simply no longer matches, so `duplicateAcknowledged` falls back to false.
  const duplicateMatchKey = duplicateMatches
    .map(m => m.id)
    .sort()
    .join("|");
  const [acknowledgedMatchKey, setAcknowledgedMatchKey] = useState<string | null>(
    null,
  );
  const duplicateAcknowledged =
    hasPostedDuplicate && acknowledgedMatchKey === duplicateMatchKey;
  const setDuplicateAcknowledged = useCallback(
    (value: boolean) => {
      setAcknowledgedMatchKey(value ? duplicateMatchKey : null);
    },
    [duplicateMatchKey],
  );

  // Bbox data flows through unchanged from the pipeline result. Today this is
  // always empty (the parser doesn't populate `bbox` on UnresolvedLine yet);
  // when a future parser does, the bidirectional highlight overlay (built in
  // phase 4) lights up automatically.
  const lineBboxes = useMemo(
    () => mapPipelineToLineBboxes(pipelineResult),
    [pipelineResult],
  );

  const handleSupplierCandidate = useCallback(
    (candidate: SupplierCandidate) => {
      // The pipeline's unmatched-supplier candidates are raw names, not ids.
      // If the name exactly matches a known supplier, select it. Otherwise
      // the chip is effectively a "use this name" affordance for a supplier
      // that doesn't exist yet — open the Create Supplier dialog pre-filled
      // with the chip's name so the user lands one click away from creating
      // it instead of having to retype it into the picker.
      const match = suppliers.find(
        s => s.name.toLowerCase() === candidate.name.toLowerCase(),
      );
      if (match) {
        setSupplierIdOverride(match.id);
        setSupplierNameOverride(candidate.name);
        return;
      }
      setSupplierNameOverride(candidate.name);
      setCreateSupplierOpen(true);
    },
    [suppliers],
  );

  const handleLineCandidate = useCallback(
    (lineId: number, candidate: ProductCandidate) => {
      // The pipeline's candidate carries no product id — match by name + sku
      // back to the catalog so we can build the submit payload.
      const product = products.find(
        p => p.name === candidate.name && (p.sku ?? "") === (candidate.sku ?? ""),
      );
      if (!product) {
        toast.error("Couldn't resolve that suggestion back to a catalog product.");
        return;
      }
      setLineProductOverrides(prev => ({
        ...prev,
        [lineId]: { productId: product.id, productName: product.name, sku: product.sku },
      }));
      setSkippedLines(prev => {
        if (!prev.has(lineId)) return prev;
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    },
    [products],
  );

  const handleSkipLine = useCallback((lineId: number) => {
    setSkippedLines(prev => {
      const next = new Set(prev);
      next.add(lineId);
      return next;
    });
  }, []);

  /** Toggle the inline weight editor for a line. First open seeds the
   *  override state with the parser's resolved weight in `total_weight`
   *  mode so closing without edits leaves the line unchanged. */
  const handleToggleLineWeightEditor = useCallback(
    (lineId: number) => {
      setOpenWeightEditorLines(prev => {
        const next = new Set(prev);
        if (next.has(lineId)) {
          next.delete(lineId);
        } else {
          next.add(lineId);
        }
        return next;
      });
      setLineWeightStates(prev => {
        if (prev[lineId]) return prev;
        const line = baseData.lines.find(l => l.id === lineId);
        if (!line) return prev;
        const prefill =
          pipelineResult.prefillResult.values.lines[lineId - 1];
        return {
          ...prev,
          [lineId]: initialLineWeightState({
            quantityCases: line.cases,
            totalWeightLbs: line.weight,
            // Honour the parser's unit-type. `fixed` on ParsedLine reads
            // the case-priced flag the deterministic stage sets; we map
            // it to the manual form's unitType enum.
            unitType:
              prefill?.unitType === "fixed_case"
                ? "fixed_case"
                : line.fixed
                  ? "fixed_case"
                  : "catch_weight",
          }),
        };
      });
    },
    [baseData.lines, pipelineResult],
  );

  const handleLineWeightChange = useCallback(
    (lineId: number, next: LineWeightState) => {
      setLineWeightStates(prev => ({ ...prev, [lineId]: next }));
    },
    [],
  );

  /** Toggle the inline lot/expiry editor for a line. First open seeds
   *  the override state with empty strings so closing without edits
   *  leaves the line unchanged (server falls back to defaults). */
  const handleToggleLineLotExpiryEditor = useCallback((lineId: number) => {
    setOpenLotExpiryEditorLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
    setLineLotExpiryStates(prev => {
      if (prev[lineId]) return prev;
      return { ...prev, [lineId]: emptyLineLotExpiryState() };
    });
  }, []);

  const handleLineLotExpiryChange = useCallback(
    (lineId: number, next: LineLotExpiryState) => {
      setLineLotExpiryStates(prev => ({ ...prev, [lineId]: next }));
    },
    [],
  );

  const handleDeleteLine = useCallback((lineId: number) => {
    setDeletedLineIds(prev => {
      const next = new Set(prev);
      next.add(lineId);
      return next;
    });
  }, []);

  const handleRestoreAllLines = useCallback(() => {
    setDeletedLineIds(new Set());
  }, []);

  const handleLineCasesChange = useCallback(
    (lineId: number, cases: number) => {
      const clamped = Number.isFinite(cases) ? Math.max(0, Math.trunc(cases)) : 0;
      setLineCasesOverrides(prev => ({ ...prev, [lineId]: clamped }));
    },
    [],
  );

  /** Direct pick from the line's product autocomplete. */
  const handleSelectLineProduct = useCallback(
    (lineId: number, product: ProductLookup) => {
      setLineProductOverrides(prev => ({
        ...prev,
        [lineId]: { productId: product.id, productName: product.name, sku: product.sku },
      }));
      setSkippedLines(prev => {
        if (!prev.has(lineId)) return prev;
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    },
    [],
  );

  const handleSelectSupplier = useCallback(
    (supplier: SupplierLookup | null) => {
      setSupplierIdOverride(supplier?.id ?? null);
      setSupplierNameOverride(supplier?.name ?? null);
    },
    [],
  );

  const handleSupplierCreated = useCallback(
    (supplier: { id: string; name: string }) => {
      setSupplierIdOverride(supplier.id);
      setSupplierNameOverride(supplier.name);
      toast.success(`Supplier "${supplier.name}" created and applied to the bill.`);
    },
    [],
  );

  /** Look up a freshly-created product (by id) and apply it to the originating line. */
  const handleProductCreated = useCallback(
    (productId: string) => {
      const lineId = createProductForLine;
      if (lineId == null) return;
      const product = products.find(p => p.id === productId);
      if (!product) {
        // The hook hasn't refetched yet — set a minimal override using the id,
        // and let the next React Query revalidation fill in the rest.
        setLineProductOverrides(prev => ({
          ...prev,
          [lineId]: { productId, productName: "New product", sku: null },
        }));
      } else {
        handleSelectLineProduct(lineId, product);
      }
      setCreateProductForLine(null);
      toast.success("Product created and applied to this line.");
    },
    [createProductForLine, products, handleSelectLineProduct],
  );

  // Map of `line.id → matched product id` — drives the line picker's
  // selected state AND the per-line cost-diff lookup below. Falls back to
  // the parser's `productId` for lines that arrived already-matched.
  const lineMatchedProductIds = useMemo(() => {
    const map: Record<number, string | null> = {};
    for (const line of baseData.lines) {
      const override = lineProductOverrides[line.id];
      if (override) {
        map[line.id] = override.productId;
        continue;
      }
      const prefillIndex = line.id - 1;
      const prefillLine = pipelineResult.prefillResult.values.lines[prefillIndex];
      map[line.id] = prefillLine?.productId || null;
    }
    return map;
  }, [baseData.lines, lineProductOverrides, pipelineResult]);

  // ── Per-line cost-change detection ──
  // Pull the recorded supplier cost per (currentSupplier, allMatchedProducts)
  // and compare against the live per-lb cost we'd write at completion.
  // Returns a per-line prop bag that LineRow can render the cost-diff
  // banner from. When the user has unacknowledged "changed"/"new" entries,
  // submit is gated to prevent silent cost overwrites.
  const productIdsForCostDiff = useMemo(() => {
    const ids = new Set<string>();
    for (const id of Object.values(lineMatchedProductIds)) {
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [lineMatchedProductIds]);
  const costDiffQuery = useSupplierCostDiffContext(
    supplierIdOverride ?? "",
    productIdsForCostDiff,
  );
  const costDiffByProductId = useMemo(() => {
    const map = new Map<
      string,
      {
        currentCostPerLb: string | null;
        dependentCustomerCount: number;
      }
    >();
    for (const entry of costDiffQuery.data?.costs ?? []) {
      map.set(entry.productId, {
        currentCostPerLb: entry.currentCostPerLb,
        dependentCustomerCount: entry.dependentCustomerCount,
      });
    }
    return map;
  }, [costDiffQuery.data]);

  type LineCostDiffProps = {
    variant: "changed" | "new";
    recordedCostPerLb: string | null;
    liveCostPerLb: string;
    productName: string;
    dependentCustomerCount: number;
    acknowledged: boolean;
    ackKey: LineCostAckKey;
  };
  const lineCostDiffByLineId = useMemo(() => {
    const map: Record<number, LineCostDiffProps | null> = {};
    if (!supplierIdOverride) return map;
    const prefillLines = pipelineResult.prefillResult.values.lines;
    for (const line of baseData.lines) {
      const productId = lineMatchedProductIds[line.id];
      if (!productId) {
        map[line.id] = null;
        continue;
      }
      const prefill = prefillLines[line.id - 1];
      if (!prefill) {
        map[line.id] = null;
        continue;
      }
      const weightOverride = lineWeightStates[line.id];
      const casesOverride = lineCasesOverrides[line.id];
      const quantityCases =
        casesOverride != null ? casesOverride : Number(prefill.quantityCases) || 0;
      const resolved = weightOverride
        ? resolveLineWeightSubmit({ quantityCases, state: weightOverride })
        : {
            weightLbs: prefill.weightLbs,
            caseWeightsLbs: null,
            unitType: prefill.unitType,
          };
      const liveCostPerLb = supplierInvoiceLineCostPerLb({
        quantityCases,
        weightLbs: resolved.weightLbs,
        unitType: resolved.unitType,
        unitPrice: prefill.unitPrice,
      });
      if (!liveCostPerLb) {
        map[line.id] = null;
        continue;
      }
      const recorded = costDiffByProductId.get(productId);
      const recordedCostPerLb = recorded?.currentCostPerLb ?? null;
      const variant: "changed" | "new" | null =
        recordedCostPerLb == null
          ? "new"
          : recordedCostPerLb === liveCostPerLb
            ? null
            : "changed";
      if (!variant) {
        map[line.id] = null;
        continue;
      }
      const key = buildCostAckKey(productId, supplierIdOverride, liveCostPerLb);
      map[line.id] = {
        variant,
        recordedCostPerLb,
        liveCostPerLb,
        productName:
          lineProductOverrides[line.id]?.productName ||
          (line.match.status === "matched" ? line.match.product : ""),
        dependentCustomerCount: recorded?.dependentCustomerCount ?? 0,
        acknowledged: acknowledgedCostKeys.has(key),
        ackKey: key,
      };
    }
    return map;
  }, [
    supplierIdOverride,
    pipelineResult,
    baseData.lines,
    lineMatchedProductIds,
    lineWeightStates,
    lineProductOverrides,
    costDiffByProductId,
    acknowledgedCostKeys,
  ]);

  const blockingCostChanges = useMemo(() => {
    let count = 0;
    for (const entry of Object.values(lineCostDiffByLineId)) {
      if (entry && !entry.acknowledged) count++;
    }
    return count;
  }, [lineCostDiffByLineId]);

  const handleToggleCostAck = useCallback((key: LineCostAckKey) => {
    setAcknowledgedCostKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!supplierIdOverride) {
      toast.error("Pick or create a supplier before saving.");
      return;
    }
    // Block-on-duplicate guard. A posted (non-draft) duplicate exists for
    // this supplier and the user hasn't checked the ack box yet. The toast
    // points at the banner so they know where to look.
    if (hasPostedDuplicate && !duplicateAcknowledged) {
      toast.error(
        "This invoice looks like a duplicate of a bill that's already posted. Confirm in the banner above to post anyway.",
      );
      return;
    }

    // Build SupplierInvoiceLineInput[] from the prefill data, swapping in
    // per-line overrides where the user picked a candidate. Skipped lines and
    // detected fees are excluded — fees are folded into the bill via charges
    // later (out of scope for this PR).
    const prefillLines = pipelineResult.prefillResult.values.lines;
    const lines = prefillLines
      .map((line, index) => {
        const lineId = index + 1;
        if (skippedLines.has(lineId)) return null;
        if (deletedLineIds.has(lineId)) return null;
        const override = lineProductOverrides[lineId];
        const productId = override?.productId ?? line.productId;
        if (!productId) return null; // unmatched + not skipped → block submit below
        const casesOverride = lineCasesOverrides[lineId];
        const quantityCases =
          casesOverride != null
            ? casesOverride
            : Number(line.quantityCases) || 0;
        // Apply weight override when present. We re-resolve from the
        // editor state via the same helpers the manual form uses so the
        // submitted `weightLbs` always matches what the user saw in the
        // tray's "Total" stat.
        const weightOverride = lineWeightStates[lineId];
        const weightPayload = weightOverride
          ? resolveLineWeightSubmit({
              quantityCases,
              state: weightOverride,
            })
          : {
              weightLbs: line.weightLbs,
              caseWeightsLbs: null,
              unitType: line.unitType,
            };
        const lotExpiryOverride = lineLotExpiryStates[lineId];
        const lotExpiryPayload = lotExpiryOverride
          ? resolveLineLotExpirySubmit(lotExpiryOverride)
          : { lotNumberOverride: null, expirationDateOverride: null };
        return {
          productId,
          quantityCases,
          weightLbs: weightPayload.weightLbs,
          caseWeightsLbs: weightPayload.caseWeightsLbs,
          unitType: weightPayload.unitType,
          unitPrice: line.unitPrice,
          lotNumberOverride: lotExpiryPayload.lotNumberOverride,
          expirationDateOverride: lotExpiryPayload.expirationDateOverride,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    const stillUnresolved = prefillLines.some((line, index) => {
      const lineId = index + 1;
      if (skippedLines.has(lineId)) return false;
      if (deletedLineIds.has(lineId)) return false;
      const override = lineProductOverrides[lineId];
      return !override && !line.productId;
    });
    if (stillUnresolved) {
      toast.error("Resolve every line or mark it as skipped before saving.");
      return;
    }

    // Block-on-cost-change guard. Posting would overwrite the recorded
    // supplier cost for one or more products without the reviewer
    // confirming the change — typically a sign of a parser misread on
    // unit price or weight, so we make the user opt in per-line.
    if (blockingCostChanges > 0) {
      toast.error(
        `Acknowledge ${blockingCostChanges} cost change${
          blockingCostChanges === 1 ? "" : "s"
        } before posting.`,
      );
      return;
    }

    setSubmitting(true);
    onSubmitStart?.();
    try {
      // Charges come from the editable panel state — seeded from the
      // parser's `detectedFees` but reclassifiable/extensible by the
      // reviewer. Empty rows (no description AND no amount) are filtered
      // out so an "Add charge" click that the user never filled in
      // doesn't get persisted.
      const chargesPayload = resolveChargesSubmit(charges);

      const result = await createSupplierInvoiceAction({
        supplierId: supplierIdOverride,
        invoiceNumber:
          pipelineResult.prefillResult.values.supplierInvoiceNumber || null,
        invoiceDate: pipelineResult.prefillResult.values.invoiceDate,
        receiveDate: pipelineResult.prefillResult.values.receiveDate,
        paymentMethod: paymentMethodOverride,
        notes: notesOverride.trim() ? notesOverride : null,
        lines,
        charges: chargesPayload,
        complete: true, // Complete & receive — creates lots + inventory atomically.
      });

      // Attach the original PDF to the new bill so it shows up in the
      // supplier-invoice detail page's attachments tab. The legacy form did
      // this via uploadParsedPdfMutation; the bulk-import flow had been
      // saving the parse data but losing the source PDF.
      // Best-effort: a failure leaves the bill itself intact and toasts the
      // mismatch so the user knows to re-attach manually.
      if (pdfFile) {
        try {
          const file =
            pdfFile instanceof File
              ? pdfFile
              : new File([pdfFile], fileName, {
                  type: pdfFile.type || "application/pdf",
                });
          const formData = new FormData();
          formData.append("supplierInvoiceId", result.id);
          formData.append("file", file);
          await uploadSupplierInvoiceAttachmentAction(formData);
        } catch (err) {
          console.warn("[review] pdf attachment upload failed", err);
          toast(
            "Bill saved, but the PDF couldn't attach automatically. Open the bill to upload it manually.",
          );
        }
      }

      // Remember-aliases: persist the user's confirmed line→product matches
      // for this supplier so future imports auto-resolve. Only the *manual*
      // overrides count — lines that came in already matched by the parser
      // don't need an alias write-through.
      if (rememberAliases && Object.keys(lineProductOverrides).length > 0) {
        const aliasEntries = Object.entries(lineProductOverrides).map(
          ([lineIdStr, override]) => {
            const lineId = Number(lineIdStr);
            const prefillLine = prefillLines[lineId - 1];
            const rawText =
              baseData.lines.find(l => l.id === lineId)?.raw ?? prefillLine?.productId ?? "";
            return {
              supplierId: supplierIdOverride,
              vendorProductName: rawText,
              internalProductId: override.productId,
            };
          },
        );
        // Best-effort — the alias write happens asynchronously after the
        // bill is committed. A failure shouldn't unwind the bill itself.
        await saveImportAliasesBatchAction(aliasEntries).catch(err => {
          console.warn("[review] alias write-through failed", err);
        });
      }

      // Flip the corresponding bulk-import row to "Reviewed" on the server
      // so the bulk-landing screen reflects the post immediately. Best-
      // effort — a failure here doesn't unwind the bill itself, the user
      // can still see the new bill in the supplier-invoices list.
      // (In queue mode the shell's completeCurrent also calls this with
      // the same id; the server-side update is idempotent so the duplicate
      // is harmless.)
      if (bulkImportKey) {
        await markBulkImportFileReviewedAction({
          id: bulkImportKey,
          supplierInvoiceId: result.id,
        }).catch(err => {
          console.warn("[review] mark-reviewed failed", err);
        });
      }
      toast.success("Bill posted to inventory.");
      if (onSubmitSuccess) {
        // Queue-mode: hand control back to the shell so it can animate the
        // current card out and advance to the next invoice. The detail
        // page is reachable from the queue's "Reviewed" pill afterwards.
        onSubmitSuccess({ supplierInvoiceId: result.id });
      } else {
        // Default single-PDF path: route to the new bill detail page.
        router.push(`/supplier-invoices/${result.id}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save the bill.";
      toast.error(message);
    } finally {
      setSubmitting(false);
      onSubmitEnd?.();
    }
  }, [
    submitting,
    supplierIdOverride,
    paymentMethodOverride,
    notesOverride,
    hasPostedDuplicate,
    duplicateAcknowledged,
    pipelineResult,
    skippedLines,
    deletedLineIds,
    lineProductOverrides,
    lineCasesOverrides,
    lineWeightStates,
    lineLotExpiryStates,
    charges,
    blockingCostChanges,
    rememberAliases,
    baseData.lines,
    bulkImportKey,
    pdfFile,
    fileName,
    router,
    onSubmitStart,
    onSubmitEnd,
    onSubmitSuccess,
  ]);

  // Queue-mode: listen for the page header's Complete event so the form's
  // existing submit() captures all of the in-form overrides. Single-PDF mode
  // ignores the event because nothing fires it.
  useEffect(() => {
    if (!onSubmitSuccess) return; // Only attach in queue mode.
    const handler = () => {
      void submit();
    };
    window.addEventListener(QUEUE_COMPLETE_EVENT, handler);
    return () => window.removeEventListener(QUEUE_COMPLETE_EVENT, handler);
  }, [onSubmitSuccess, submit]);

  return (
    <>
      <ReviewScreen
        data={enriched}
        pdfFile={pdfFile}
        pdfLoadError={pdfLoadError}
        lineBboxes={lineBboxes.length > 0 ? lineBboxes : undefined}
        onSubmit={submit}
        submitDisabled={
          submitting ||
          (hasPostedDuplicate && !duplicateAcknowledged) ||
          blockingCostChanges > 0
        }
        topSlot={topSlot}
        headerSlot={headerSlot}
        pdfPaneAccessory={pdfPaneAccessory}
        paneEnterDirection={paneEnterDirection}
        onCancel={() => router.push("/supplier-invoices/bulk")}
        // Re-parse is parked while the server-side bulk_import_files row is
        // the source of truth — the legacy parsing screen reads from
        // IndexedDB, which the new server flow no longer populates.
        // Tracked as a follow-up alongside the single-PDF migration.
        onReparse={undefined}
        onSelectLineCandidate={handleLineCandidate}
        onSelectLineProduct={handleSelectLineProduct}
        onSkipLine={handleSkipLine}
        onCreateLineProduct={lineId => setCreateProductForLine(lineId)}
        lineWeightStates={lineWeightStates}
        openWeightEditorLines={openWeightEditorLines}
        onToggleLineWeightEditor={handleToggleLineWeightEditor}
        onLineWeightChange={handleLineWeightChange}
        lineLotExpiryStates={lineLotExpiryStates}
        openLotExpiryEditorLines={openLotExpiryEditorLines}
        onToggleLineLotExpiryEditor={handleToggleLineLotExpiryEditor}
        onLineLotExpiryChange={handleLineLotExpiryChange}
        lineCostDiffs={lineCostDiffByLineId}
        onToggleCostAck={handleToggleCostAck}
        charges={charges}
        onChargesChange={setCharges}
        deletedLineIds={deletedLineIds}
        onDeleteLine={handleDeleteLine}
        onRestoreAllLines={handleRestoreAllLines}
        onLineCasesChange={handleLineCasesChange}
        onSelectSupplierCandidate={handleSupplierCandidate}
        onCreateSupplier={() => setCreateSupplierOpen(true)}
        onSelectSupplier={handleSelectSupplier}
        paymentMethod={paymentMethodOverride}
        onPaymentMethodChange={setPaymentMethodOverride}
        notes={notesOverride}
        onNotesChange={setNotesOverride}
        suppliers={suppliers}
        products={products}
        supplierSelectedId={supplierIdOverride}
        lineMatchedProductIds={lineMatchedProductIds}
        rememberAliases={rememberAliases}
        onRememberAliasesChange={setRememberAliases}
        duplicateMatches={duplicateMatches}
        duplicateAcknowledged={duplicateAcknowledged}
        onDuplicateAcknowledgedChange={setDuplicateAcknowledged}
      />
      <CreateSupplierDialog
        open={createSupplierOpen}
        onOpenChange={setCreateSupplierOpen}
        initialName={supplierNameOverride ?? baseData.parsed.supplier.value}
        onCreated={handleSupplierCreated}
      />
      <CreateProductDialog
        open={createProductForLine != null}
        onOpenChange={open => {
          if (!open) setCreateProductForLine(null);
        }}
        initialName={
          createProductForLine != null
            ? baseData.lines.find(l => l.id === createProductForLine)?.raw ?? ""
            : ""
        }
        onCreated={handleProductCreated}
      />
    </>
  );
}

function enrichData({
  baseData,
  supplierNameOverride,
  lineProductOverrides,
  lineCasesOverrides,
  skippedLines,
}: {
  baseData: ReturnType<typeof mapPipelineToReviewData>;
  supplierNameOverride: string | null;
  lineProductOverrides: Record<
    number,
    { productId: string; productName: string; sku: string | null }
  >;
  lineCasesOverrides: Record<number, number>;
  skippedLines: Set<number>;
}) {
  return {
    ...baseData,
    parsed: {
      ...baseData.parsed,
      supplier: {
        ...baseData.parsed.supplier,
        value: supplierNameOverride ?? baseData.parsed.supplier.value,
      },
    },
    lines: baseData.lines.map(line =>
      applyLineOverrides({
        line,
        override: lineProductOverrides[line.id],
        casesOverride: lineCasesOverrides[line.id],
        skipped: skippedLines.has(line.id),
      }),
    ),
  };
}

function applyLineOverrides({
  line,
  override,
  casesOverride,
  skipped,
}: {
  line: ParsedLine;
  override?: { productId: string; productName: string; sku: string | null };
  casesOverride?: number;
  skipped: boolean;
}): ParsedLine {
  // Apply cases override before product/skip so downstream consumers
  // (NumericSnapshot, weight editor's quantityCases, footer totals) all
  // see the corrected count without needing to peek at the override map.
  const withCases =
    casesOverride != null && casesOverride !== line.cases
      ? { ...line, cases: casesOverride }
      : line;
  line = withCases;
  if (skipped) {
    return {
      ...line,
      match: { status: "fee", candidates: line.match.candidates },
    };
  }
  if (!override) return line;
  return {
    ...line,
    match: {
      status: "matched",
      product: override.productName,
      sku: override.sku ?? "",
      score: 100,
      candidates: line.match.candidates,
    },
  };
}
