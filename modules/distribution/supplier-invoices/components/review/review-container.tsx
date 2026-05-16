"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useProducts } from "@/modules/distribution/products/hooks/use-products";
import { useSuppliers } from "@/modules/distribution/suppliers/hooks/use-suppliers";

import { CreateProductDialog } from "../create-product-dialog";
import { CreateSupplierDialog } from "../create-supplier-dialog";

import {
  createSupplierInvoiceAction,
  saveImportAliasesBatchAction,
  uploadSupplierInvoiceAttachmentAction,
} from "../../actions";
import type { PipelineResult } from "../../services/parsing-pipeline";
import {
  clearPendingBulkImportResultOnly,
  markBulkImportReviewed,
} from "../../utils/bulk-import-storage";

import {
  mapPipelineToLineBboxes,
  mapPipelineToReviewData,
  type ProductLookup,
  type SupplierLookup,
} from "./map-pipeline-to-review-data";
import { ReviewScreen } from "./review-screen";
import type { ParsedLine, ProductCandidate, SupplierCandidate } from "./types";

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
   * Optional localStorage key the parse was loaded from. When set, a successful
   * submit marks the corresponding entry as `reviewed` so the bulk-landing
   * row flips to the "Reviewed" status pill without a manual reload.
   */
  bulkImportKey?: string | null;
  /** Queue-mode pass-through slots — see ReviewScreen for details. */
  topSlot?: ReactNode;
  headerSlot?: ReactNode;
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
  const [lineProductOverrides, setLineProductOverrides] = useState<
    Record<number, { productId: string; productName: string; sku: string | null }>
  >({});
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
      skippedLines,
    });
  }, [baseData, supplierNameOverride, lineProductOverrides, skippedLines]);

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

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!supplierIdOverride) {
      toast.error("Pick or create a supplier before saving.");
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
        const override = lineProductOverrides[lineId];
        const productId = override?.productId ?? line.productId;
        if (!productId) return null; // unmatched + not skipped → block submit below
        return {
          productId,
          quantityCases: Number(line.quantityCases) || 0,
          weightLbs: line.weightLbs,
          unitType: line.unitType,
          unitPrice: line.unitPrice,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    const stillUnresolved = prefillLines.some((line, index) => {
      const lineId = index + 1;
      if (skippedLines.has(lineId)) return false;
      const override = lineProductOverrides[lineId];
      return !override && !line.productId;
    });
    if (stillUnresolved) {
      toast.error("Resolve every line or mark it as skipped before saving.");
      return;
    }

    setSubmitting(true);
    onSubmitStart?.();
    try {
      const result = await createSupplierInvoiceAction({
        supplierId: supplierIdOverride,
        invoiceNumber:
          pipelineResult.prefillResult.values.supplierInvoiceNumber || null,
        invoiceDate: pipelineResult.prefillResult.values.invoiceDate,
        receiveDate: pipelineResult.prefillResult.values.receiveDate,
        paymentMethod: pipelineResult.prefillResult.values.paymentMethod ?? null,
        notes: pipelineResult.prefillResult.values.notes || null,
        lines,
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

      // Flip the corresponding bulk-import row to "Reviewed" so the landing
      // tab updates immediately on focus. The entry is intentionally NOT
      // deleted — it stays around (until TTL) so the user can re-open it.
      // (In queue mode the shell's completeCurrent also calls this with
      // the same id; it's idempotent so the duplicate is harmless.)
      if (bulkImportKey) {
        markBulkImportReviewed(bulkImportKey, result.id);
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
    pipelineResult,
    skippedLines,
    lineProductOverrides,
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

  const lineMatchedProductIds = useMemo(() => {
    const map: Record<number, string | null> = {};
    for (const line of baseData.lines) {
      const override = lineProductOverrides[line.id];
      if (override) {
        map[line.id] = override.productId;
        continue;
      }
      // Fall back to the prefill row's productId so already-matched lines
      // start with their picker selected.
      const prefillIndex = line.id - 1;
      const prefillLine = pipelineResult.prefillResult.values.lines[prefillIndex];
      map[line.id] = prefillLine?.productId || null;
    }
    return map;
  }, [baseData.lines, lineProductOverrides, pipelineResult]);

  return (
    <>
      <ReviewScreen
        data={enriched}
        pdfFile={pdfFile}
        lineBboxes={lineBboxes.length > 0 ? lineBboxes : undefined}
        onSubmit={submit}
        submitDisabled={submitting}
        topSlot={topSlot}
        headerSlot={headerSlot}
        pdfPaneAccessory={pdfPaneAccessory}
        paneEnterDirection={paneEnterDirection}
        onCancel={() => router.push("/supplier-invoices/bulk")}
        onReparse={
          bulkImportKey
            ? () => {
                // Drop the cached parse result and walk the user through the
                // parsing screen, which reads the PDF blob still in IndexedDB
                // and re-runs the parser. Overrides the user picked here are
                // discarded — the whole point of re-parsing is to start fresh.
                clearPendingBulkImportResultOnly(bulkImportKey);
                router.push(
                  `/supplier-invoices/parsing/${encodeURIComponent(bulkImportKey)}`,
                );
              }
            : undefined
        }
        onSelectLineCandidate={handleLineCandidate}
        onSelectLineProduct={handleSelectLineProduct}
        onSkipLine={handleSkipLine}
        onCreateLineProduct={lineId => setCreateProductForLine(lineId)}
        onSelectSupplierCandidate={handleSupplierCandidate}
        onCreateSupplier={() => setCreateSupplierOpen(true)}
        onSelectSupplier={handleSelectSupplier}
        suppliers={suppliers}
        products={products}
        supplierSelectedId={supplierIdOverride}
        lineMatchedProductIds={lineMatchedProductIds}
        rememberAliases={rememberAliases}
        onRememberAliasesChange={setRememberAliases}
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
  skippedLines,
}: {
  baseData: ReturnType<typeof mapPipelineToReviewData>;
  supplierNameOverride: string | null;
  lineProductOverrides: Record<
    number,
    { productId: string; productName: string; sku: string | null }
  >;
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
        skipped: skippedLines.has(line.id),
      }),
    ),
  };
}

function applyLineOverrides({
  line,
  override,
  skipped,
}: {
  line: ParsedLine;
  override?: { productId: string; productName: string; sku: string | null };
  skipped: boolean;
}): ParsedLine {
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
