"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useProducts } from "@/modules/distribution/products/hooks/use-products";
import { useSuppliers } from "@/modules/distribution/suppliers/hooks/use-suppliers";

import { createSupplierInvoiceAction } from "../../actions";
import type { PipelineResult } from "../../services/parsing-pipeline";

import {
  mapPipelineToReviewData,
  type ProductLookup,
  type SupplierLookup,
} from "./map-pipeline-to-review-data";
import { ReviewScreen } from "./review-screen";
import type { ParsedLine, ProductCandidate, SupplierCandidate } from "./types";

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
  pdfUrl,
}: {
  fileName: string;
  fileSize?: string;
  pages?: number;
  pipelineResult: PipelineResult;
  /** Object URL for the original PDF, when the bulk-import handoff had one. */
  pdfUrl?: string | null;
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

  const enriched = useMemo(() => {
    return enrichData({
      baseData,
      supplierNameOverride,
      lineProductOverrides,
      skippedLines,
    });
  }, [baseData, supplierNameOverride, lineProductOverrides, skippedLines]);

  const handleSupplierCandidate = useCallback(
    (candidate: SupplierCandidate) => {
      // The pipeline's unmatched-supplier candidates are raw names, not ids.
      // Try to resolve to a known supplier by name; otherwise just fill the
      // text so the user can review.
      const match = suppliers.find(
        s => s.name.toLowerCase() === candidate.name.toLowerCase(),
      );
      setSupplierIdOverride(match?.id ?? null);
      setSupplierNameOverride(candidate.name);
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
        complete: false,
      });
      toast.success("Draft bill saved.");
      router.push(`/supplier-invoices/${result.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save the bill.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    supplierIdOverride,
    pipelineResult,
    skippedLines,
    lineProductOverrides,
    router,
  ]);

  return (
    <ReviewScreen
      data={enriched}
      pdfUrl={pdfUrl}
      lineBboxes={undefined}
      onSubmit={submit}
      submitDisabled={submitting}
      onCancel={() => router.push("/supplier-invoices/bulk")}
      onSelectLineCandidate={handleLineCandidate}
      onSkipLine={handleSkipLine}
      onSelectSupplierCandidate={handleSupplierCandidate}
    />
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
