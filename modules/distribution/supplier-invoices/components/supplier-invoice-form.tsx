"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { useProducts } from "@/modules/distribution/products/hooks/use-products";
import { useSuppliers } from "@/modules/distribution/suppliers/hooks/use-suppliers";
import { useSidebar } from "@/components/ui/sidebar";
import {
  computeDraftLineWeight,
  serializeDraftCaseWeights,
} from "@/modules/distribution/supplier-invoices/utils/case-weights";
import { supplierInvoiceLineCostPerLb } from "@/modules/distribution/supplier-invoices/utils/cost";
import {
  useCreateSupplierInvoice,
  useUpdateSupplierInvoice,
  useCompleteSupplierInvoice,
  useParseSupplierInvoicePdf,
  useUploadSupplierInvoiceAttachmentToInvoice,
  useNextSupplierInvoiceNumber,
  useSupplierCostDiffContext,
} from "../hooks/use-supplier-invoices";
import { saveImportAliasesBatchAction } from "../actions";
import {
  createSupplierInvoiceAction,
  updateSupplierInvoiceAction,
} from "../actions";
import {
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { can, getPermissionDeniedReason } from "@/lib/auth/permissions";

import { SupplierInvoiceAttachmentsPlaceholder } from "./supplier-invoice-attachments-placeholder";
import {
  emptyCharge,
  emptyLine,
  supplierInvoiceChargeTypes,
  supplierInvoiceFormSchema,
  type SupplierInvoiceChargeValues,
  type SupplierInvoiceFormValues,
} from "./supplier-invoice-form.schema";
import {
  ackKey as makeAckKey,
  LineItemsInvoiceTotal,
  SupplierInvoiceLinesEditor,
  type LineCostAckKey,
} from "./supplier-invoice-lines-editor";
import { AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";
import type { PipelineResult } from "@/modules/distribution/supplier-invoices/services/parsing-pipeline";
import { ImportReviewView } from "./import-review-view";
import { FirstBillPanel } from "./first-bill-panel";
import { IngestionPanel } from "./ingestion-panel";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#fafaf9",
  surface: "#ffffff",
  surfaceAlt: "#f5f5f4",
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  mutedSoft: "#a8a29e",
  line: "#e7e5e4",
  lineStrong: "#d4d1c7",
  good: "oklch(58% 0.13 155)",
  warn: "oklch(70% 0.13 70)",
  mono: "var(--font-mono)",
} as const;

const MAX_PDF_BYTES = 20 * 1024 * 1024;

// ── Types ──────────────────────────────────────────────────────────────────
type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  invoiceId?: string;
  initialValues?: SupplierInvoiceFormValues;
  /**
   * Pre-parsed pipeline result handed down by the bulk-import review flow.
   * When set in create mode, the form seeds its state from this result on
   * mount — the same code path the file-upload handler uses — so the user
   * lands on a fully populated review screen without re-uploading the PDF.
   */
  prefilledPipelineResult?: PipelineResult;
  /**
   * Original PDF file that produced `prefilledPipelineResult`, pulled from
   * IndexedDB by the bulk-import handoff. When present, the review screen
   * shows the PDF preview pane next to the form and the file is uploaded
   * as an attachment once the draft is saved — matching single-import.
   */
  prefilledPdfFile?: File | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── ChargeRow ──────────────────────────────────────────────────────────────

const CHARGE_TYPE_LABELS: Record<string, string> = {
  freight: "Freight",
  fuel: "Fuel",
  tax: "Tax",
  discount: "Discount",
  other: "Other",
};

function ChargeRow({
  index,
  register,
  control,
  errors,
  onRemove,
  disabled,
}: {
  index: number;
  register: ReturnType<typeof useForm<SupplierInvoiceFormValues>>["register"];
  control: ReturnType<typeof useForm<SupplierInvoiceFormValues>>["control"];
  errors?: {
    description?: { message?: string };
    amount?: { message?: string };
    rate?: { message?: string };
  };
  onRemove: () => void;
  disabled: boolean;
}) {
  const chargeType = useWatch({ control, name: `charges.${index}.chargeType` });
  const includeInCost = useWatch({ control, name: `charges.${index}.includeInInventoryCost` });
  const isDiscount = chargeType === "discount";
  const isTax = chargeType === "tax";

  const inputBase: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "7px 10px",
    fontSize: 13,
    borderRadius: 6,
    background: C.surface,
    color: C.ink,
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 110px 80px 110px 76px 28px",
        gap: 6,
        alignItems: "start",
      }}
    >
      {/* Description */}
      <div>
        <input
          {...register(`charges.${index}.description`)}
          placeholder="Description"
          disabled={disabled}
          style={{
            ...inputBase,
            border: `1px solid ${errors?.description ? "oklch(55% 0.18 27)" : C.line}`,
          }}
        />
        {errors?.description?.message && (
          <div style={{ fontSize: 11, color: "oklch(55% 0.18 27)", marginTop: 2 }}>
            {errors.description.message}
          </div>
        )}
      </div>

      {/* Type */}
      <Controller
        control={control}
        name={`charges.${index}.chargeType`}
        render={({ field }) => (
          <select
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            style={{
              ...inputBase,
              border: `1px solid ${C.line}`,
              cursor: disabled ? "not-allowed" : "pointer",
              appearance: "auto",
            }}
          >
            {supplierInvoiceChargeTypes.map(t => (
              <option key={t} value={t}>{CHARGE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        )}
      />

      {/* Rate (% — only active for tax) */}
      <div style={{ position: "relative" }}>
        <input
          {...register(`charges.${index}.rate`)}
          placeholder={isTax ? "0.00" : "—"}
          disabled={disabled || !isTax}
          style={{
            ...inputBase,
            border: `1px solid ${errors?.rate ? "oklch(55% 0.18 27)" : C.line}`,
            opacity: isTax ? 1 : 0.4,
            paddingRight: isTax ? 22 : 10,
            fontFamily: C.mono,
            textAlign: "right",
          }}
        />
        {isTax && (
          <span
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              color: C.mutedSoft,
              pointerEvents: "none",
            }}
          >
            %
          </span>
        )}
      </div>

      {/* Amount */}
      <div>
        <input
          {...register(`charges.${index}.amount`)}
          placeholder="0.00"
          disabled={disabled}
          style={{
            ...inputBase,
            border: `1px solid ${errors?.amount ? "oklch(55% 0.18 27)" : C.line}`,
            fontFamily: C.mono,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
            color: isDiscount ? "oklch(50% 0.15 155)" : C.ink,
          }}
        />
        {errors?.amount?.message && (
          <div style={{ fontSize: 11, color: "oklch(55% 0.18 27)", marginTop: 2 }}>
            {errors.amount.message}
          </div>
        )}
      </div>

      {/* In-cost toggle */}
      <Controller
        control={control}
        name={`charges.${index}.includeInInventoryCost`}
        render={({ field }) => (
          <button
            type="button"
            onClick={() => field.onChange(!field.value)}
            disabled={disabled}
            title={field.value ? "Included in inventory cost" : "Excluded from inventory cost"}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "transparent",
              border: "none",
              cursor: disabled ? "not-allowed" : "pointer",
              padding: "4px 0",
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                width: 30,
                height: 17,
                borderRadius: 99,
                background: field.value ? "oklch(58% 0.13 155)" : C.lineStrong,
                position: "relative",
                transition: "background 0.15s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: field.value ? 15 : 2,
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.15s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: field.value ? "oklch(58% 0.13 155)" : C.mutedSoft,
              }}
            >
              In cost
            </span>
          </button>
        )}
      />

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 34,
          borderRadius: 6,
          border: `1px solid ${C.line}`,
          background: "transparent",
          color: C.muted,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <Trash2 style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}

// ── ChargesSubtotal ────────────────────────────────────────────────────────
function ChargesSubtotal({ control }: { control: ReturnType<typeof useForm<SupplierInvoiceFormValues>>["control"] }) {
  const charges = useWatch({ control, name: "charges" }) as SupplierInvoiceChargeValues[];
  const total = (charges ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const inCostTotal = (charges ?? []).reduce(
    (sum, c) => sum + (c.includeInInventoryCost ? Number(c.amount) || 0 : 0),
    0,
  );
  const fmt = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
      <span style={{ fontFamily: C.mono, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: C.ink }}>
        {fmt(total)}
      </span>
      {inCostTotal > 0 && (
        <span style={{ fontSize: 11, color: "oklch(58% 0.13 155)", fontFamily: C.mono }}>
          {fmt(inCostTotal)} capitalized
        </span>
      )}
    </div>
  );
}

function defaultCreateValues(): SupplierInvoiceFormValues {
  const t = today();
  return {
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: t,
    receiveDate: t,
    paymentMethod: null,
    notes: "",
    lines: [emptyLine()],
    charges: [],
  };
}

// ── Shared card primitives ─────────────────────────────────────────────────
function SectionCard({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 28px",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {header}
      </div>
      {children}
    </div>
  );
}

function CardTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 24,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: C.ink,
            marginBottom: subtitle ? 4 : 0,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 13,
              color: C.muted,
              maxWidth: 600,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

const lblStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: C.muted,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const inputCls =
  "border-stone-line bg-stone-surface text-sm text-stone-ink shadow-none";


// ── Component ──────────────────────────────────────────────────────────────
export function SupplierInvoiceForm({
  mode,
  invoiceId,
  initialValues,
  prefilledPipelineResult,
  prefilledPdfFile,
}: Props) {
  const router = useRouter();
  const { state: sidebarState, isMobile } = useSidebar();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: products, isLoading: productsLoading } = useProducts();

  const createMutation = useCreateSupplierInvoice();
  const updateMutation = useUpdateSupplierInvoice();
  const completeMutation = useCompleteSupplierInvoice();
  const parsePdfMutation = useParseSupplierInvoicePdf();
  const uploadParsedPdfMutation = useUploadSupplierInvoiceAttachmentToInvoice();
  const { data: currentUser } = useCurrentPortalUser();
  const role = currentUser?.role ?? null;
  const canEdit = can(role, "edit_supplier_invoice");
  const canComplete = can(role, "complete_supplier_invoice");
  const editDeniedReason = canEdit
    ? undefined
    : getPermissionDeniedReason("edit_supplier_invoice");
  const completeDeniedReason = canComplete
    ? undefined
    : getPermissionDeniedReason("complete_supplier_invoice");

  const form = useForm<SupplierInvoiceFormValues>({
    resolver: zodResolver(supplierInvoiceFormSchema),
    defaultValues: initialValues ?? defaultCreateValues(),
  });

  const { fields: chargeFields, append: appendCharge, remove: removeCharge, replace: replaceCharges } =
    useFieldArray({ control: form.control, name: "charges" });

  // Auto-suggest a fresh `INV-YYYYMMDD-NN` for new bills. Only runs in create
  // mode, and only fills the field if the user hasn't already typed anything
  // (e.g. PDF-prefill or supplier's real invoice number takes precedence).
  const shouldSuggestInvoiceNumber =
    mode === "create" && !initialValues?.invoiceNumber;
  const nextNumberQuery = useNextSupplierInvoiceNumber({
    enabled: shouldSuggestInvoiceNumber,
  });
  const invoiceNumberPrefilledRef = useRef(false);
  useEffect(() => {
    if (!shouldSuggestInvoiceNumber) return;
    if (invoiceNumberPrefilledRef.current) return;
    const suggested = nextNumberQuery.data;
    if (!suggested) return;
    const current = form.getValues("invoiceNumber");
    if (current && current.trim()) {
      invoiceNumberPrefilledRef.current = true;
      return;
    }
    form.setValue("invoiceNumber", suggested, { shouldDirty: false });
    invoiceNumberPrefilledRef.current = true;
  }, [shouldSuggestInvoiceNumber, nextNumberQuery.data, form]);

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    completeMutation.isPending ||
    parsePdfMutation.isPending ||
    uploadParsedPdfMutation.isPending;

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [pdfPrefill, setPdfPrefill] = useState<PipelineResult | null>(null);
  const [pdfUnresolvedCount, setPdfUnresolvedCount] = useState(0);
  // Maps vendorProductName → form line index for resolved lines.
  // Built when a PDF is parsed; updated as the user accepts/chooses products.
  const [vendorNameLineMap, setVendorNameLineMap] = useState<Map<string, number>>(new Map());
  // Per-form-line vendor product names (from PDF import), indexed to match the lines array.
  const [lineVendorNames, setLineVendorNames] = useState<(string | null)[]>([]);
  // Vendor names whose aliases were already saved via the review panel — skip on submit.
  const savedAliasNamesRef = useRef<Set<string>>(new Set());
  // Vendor names where no product could be auto-filled — drive the footer warning counter.
  const [trulyUnresolvedNames, setTrulyUnresolvedNames] = useState<Set<string>>(new Set());
  const watchedSupplierId = useWatch({ control: form.control, name: "supplierId" }) ?? "";
  const watchedCharges = useWatch({ control: form.control, name: "charges" });
  const chargesTotal = (watchedCharges ?? []).reduce(
    (sum: number, c: SupplierInvoiceChargeValues) => sum + (parseFloat(c.amount) || 0),
    0,
  );

  // ── Live cost-diff context (drives the per-line callout + Complete gate) ──
  const watchedLinesRaw = useWatch({ control: form.control, name: "lines" });
  const watchedLines = useMemo(() => watchedLinesRaw ?? [], [watchedLinesRaw]);
  const productIdsOnForm = useMemo(
    () =>
      Array.from(
        new Set(
          watchedLines.map(l => l?.productId).filter((v): v is string => !!v),
        ),
      ),
    [watchedLines],
  );
  const { data: costDiffData } = useSupplierCostDiffContext(
    watchedSupplierId,
    productIdsOnForm,
  );
  const costDiffByProductId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof costDiffData>["costs"][number]>();
    for (const entry of costDiffData?.costs ?? []) {
      map.set(entry.productId, entry);
    }
    return map;
  }, [costDiffData]);

  const [acknowledgedKeys, setAcknowledgedKeys] = useState<Set<LineCostAckKey>>(
    () => new Set(),
  );
  const toggleAck = (key: LineCostAckKey) => {
    setAcknowledgedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Unacknowledged supplier-cost changes that should block "Complete & receive".
  const blockingChangesCount = useMemo(() => {
    if (!watchedSupplierId) return 0;
    let count = 0;
    for (const line of watchedLines) {
      if (!line?.productId) continue;
      const liveCost = supplierInvoiceLineCostPerLb({
        quantityCases: Number(line.quantityCases) || 0,
        weightLbs:
          line.unitType === "catch_weight"
            ? computeDraftLineWeight(line).toFixed(4)
            : line.weightLbs || "0",
        unitType: line.unitType,
        unitPrice: line.unitPrice || "0",
      });
      if (!liveCost) continue;
      const entry = costDiffByProductId.get(line.productId);
      const recorded = entry?.currentCostPerLb ?? null;
      // No change → not blocking.
      if (recorded && recorded === liveCost) continue;
      // Unchanged "new" lines (no recorded) still require an ack so the user
      // explicitly accepts the first-time cost.
      const key = makeAckKey(line.productId, watchedSupplierId, liveCost);
      if (!acknowledgedKeys.has(key)) count++;
    }
    return count;
  }, [watchedSupplierId, watchedLines, costDiffByProductId, acknowledgedKeys]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const draftIdRef = useRef<string | null>(invoiceId ?? null);
  const autoSaveInProgressRef = useRef(false);
  const isPendingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    isPendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const { unsubscribe } = form.watch(() => {
      clearTimeout(autoSaveTimerRef.current);
      if (isPendingRef.current || autoSaveInProgressRef.current) return;

      autoSaveTimerRef.current = setTimeout(async () => {
        if (isPendingRef.current || autoSaveInProgressRef.current) return;

        const v = form.getValues();
        const ready =
          !!v.supplierId &&
          !!v.invoiceNumber &&
          !!v.invoiceDate &&
          !!v.receiveDate &&
          (v.lines ?? []).some((l) => !!l?.productId);
        if (!ready) return;

        autoSaveInProgressRef.current = true;
        setAutoSaveStatus("saving");

        const lines = (v.lines ?? []).map((line) => ({
          id: line.id,
          productId: line.productId,
          quantityCases: Number(line.quantityCases) || 0,
          weightLbs:
            line.unitType === "catch_weight"
              ? computeDraftLineWeight(line).toFixed(4)
              : line.weightLbs || "0",
          unitType: line.unitType,
          unitPrice: line.unitPrice || "0",
          caseWeightsLbs: serializeDraftCaseWeights(line),
          lotNumberOverride: line.lotNumberOverride?.trim() || null,
          expirationDateOverride: line.expirationDateOverride?.trim() || null,
        }));

        const payload = {
          supplierId: v.supplierId,
          invoiceNumber: v.invoiceNumber,
          invoiceDate: v.invoiceDate,
          receiveDate: v.receiveDate,
          paymentMethod: v.paymentMethod ?? null,
          notes: v.notes || null,
          lines,
        };

        try {
          // Call the server actions directly here — going through the
          // useMutation hooks would flip `createMutation.isPending` /
          // `updateMutation.isPending`, which `isPending` (above) ORs into
          // every `disabled` prop on the form. Silent autosave must not
          // disable the inputs the user is actively typing into.
          if (!draftIdRef.current) {
            const result = await createSupplierInvoiceAction({
              ...payload,
              complete: false,
            });
            draftIdRef.current = result.id;
          } else {
            await updateSupplierInvoiceAction({
              id: draftIdRef.current,
              ...payload,
            });
          }
          setAutoSaveStatus("saved");
        } catch {
          setAutoSaveStatus("error");
        } finally {
          autoSaveInProgressRef.current = false;
        }
      }, 1500);
    });

    return () => {
      unsubscribe();
      clearTimeout(autoSaveTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelPath = invoiceId
    ? `/supplier-invoices/${invoiceId}`
    : "/supplier-invoices";

  function handleReadPdfClick() {
    pdfInputRef.current?.click();
  }

  // Apply a parsed PipelineResult to the form state. Used by both the
  // file-upload handler (which produces the result via parsePdfMutation) and
  // the bulk-import review flow (which hands the result over via the
  // `prefilledPipelineResult` prop after parsing on a separate request).
  const seedFromPipelineResult = useCallback(
    (result: PipelineResult, options: { pdfFile: File | null } = { pdfFile: null }) => {
      form.reset(result.prefillResult.values);
      setPendingPdfFile(options.pdfFile);
      setPdfPrefill(result);
      savedAliasNamesRef.current = new Set();

      // Only count lines where no product was auto-filled (confidence < 60 or
      // no suggestion). AI suggestions with confidence ≥ 60 are pre-selected
      // in the form already.
      const newTrulyUnresolved = new Set(
        result.unresolvedLines
          .filter(l => !l.suggestedProductId || l.confidence < 60)
          .map(l => l.vendorProductName),
      );
      setTrulyUnresolvedNames(newTrulyUnresolved);
      setPdfUnresolvedCount(newTrulyUnresolved.size);
      setAutoSaveStatus("idle");

      // Map vendor name → form line index for lines still needing product
      // selection. unmatchedLineDescriptions[k] corresponds to the (k+1)-th
      // form line with empty productId.
      const newMap = new Map<string, number>();
      let unmatchedIdx = 0;
      const unmatchedNames = result.prefillResult.unmatchedLineDescriptions;
      for (let i = 0; i < result.prefillResult.values.lines.length; i++) {
        if (
          !result.prefillResult.values.lines[i].productId &&
          unmatchedIdx < unmatchedNames.length
        ) {
          newMap.set(unmatchedNames[unmatchedIdx], i);
          unmatchedIdx++;
        }
      }
      setVendorNameLineMap(newMap);

      // Build per-line vendor name array for the lines editor display
      // (invert newMap).
      const vendorNames: (string | null)[] = Array(
        result.prefillResult.values.lines.length,
      ).fill(null);
      for (const [vendorName, lineIdx] of newMap) {
        vendorNames[lineIdx] = vendorName;
      }
      setLineVendorNames(vendorNames);

      if (result.detectedFees.length > 0) {
        replaceCharges(
          result.detectedFees.map(f => ({
            description: f.description,
            chargeType: "other" as const,
            rate: "",
            includeInInventoryCost: false,
            amount: f.amount > 0 ? f.amount.toFixed(4) : "",
          })),
        );
      }
    },
    [
      form,
      replaceCharges,
      setAutoSaveStatus,
      setLineVendorNames,
      setPdfPrefill,
      setPdfUnresolvedCount,
      setPendingPdfFile,
      setTrulyUnresolvedNames,
      setVendorNameLineMap,
    ],
  );

  // Seed once from the bulk-import handoff. Effect runs only on mount in
  // create mode — edit mode already populates initialValues from the DB.
  const hasSeededFromPrefilledRef = useRef(false);
  useEffect(() => {
    if (mode !== "create") return;
    if (!prefilledPipelineResult) return;
    if (hasSeededFromPrefilledRef.current) return;
    hasSeededFromPrefilledRef.current = true;
    // Carry the prefilled PDF through so the review pane appears and the
    // file uploads as an attachment when the draft is saved.
    seedFromPipelineResult(prefilledPipelineResult, {
      pdfFile: prefilledPdfFile ?? null,
    });
    toast.success(
      "Loaded parsed PDF. Review every field before saving the draft.",
    );
  }, [
    mode,
    prefilledPipelineResult,
    prefilledPdfFile,
    seedFromPipelineResult,
  ]);

  async function handlePdfFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      toast.error(`PDF is too large. Max ${MAX_PDF_BYTES / (1024 * 1024)} MB.`);
      return;
    }

    try {
      const result = await parsePdfMutation.mutateAsync(file);
      seedFromPipelineResult(result, { pdfFile: file });
      toast.success(`Read ${file.name}. Review the imported fields before saving.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not read this PDF.",
      );
    }
  }

  async function attachPendingPdf(targetInvoiceId: string) {
    if (!pendingPdfFile) return;
    try {
      await uploadParsedPdfMutation.mutateAsync({
        supplierInvoiceId: targetInvoiceId,
        file: pendingPdfFile,
      });
      toast.success(`Attached ${pendingPdfFile.name}.`);
      setPendingPdfFile(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Bill saved, but PDF attachment failed: ${err.message}`
          : "Bill saved, but PDF attachment failed.",
      );
    }
  }

  async function submit(
    values: SupplierInvoiceFormValues,
    complete: boolean,
  ) {
    const normalizedLines = values.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      quantityCases: Number(line.quantityCases) || 0,
      weightLbs:
        line.unitType === "catch_weight"
          ? computeDraftLineWeight(line).toFixed(4)
          : line.weightLbs || "0",
      unitType: line.unitType,
      unitPrice: line.unitPrice || "0",
      caseWeightsLbs: serializeDraftCaseWeights(line),
      lotNumberOverride: line.lotNumberOverride?.trim() || null,
      expirationDateOverride: line.expirationDateOverride?.trim() || null,
    }));

    const payload = {
      supplierId: values.supplierId,
      invoiceNumber: values.invoiceNumber,
      invoiceDate: values.invoiceDate,
      receiveDate: values.receiveDate,
      paymentMethod: values.paymentMethod ?? null,
      notes: values.notes || null,
      lines: normalizedLines,
      charges: values.charges.map(c => ({
        description: c.description,
        chargeType: c.chargeType,
        rate: c.rate || null,
        includeInInventoryCost: c.includeInInventoryCost,
        amount: c.amount || "0",
      })),
    };

    const existingDraftId = draftIdRef.current;

    try {
      let targetId: string;

      if (mode === "create" && !existingDraftId) {
        // No auto-save draft yet — create fresh
        const result = await createMutation.mutateAsync({
          ...payload,
          complete,
        });
        draftIdRef.current = result.id;
        targetId = result.id;
        toast.success(
          complete
            ? `Bill "${values.invoiceNumber}" received. Lots and inventory created.`
            : `Draft bill "${values.invoiceNumber}" saved.`,
        );
      } else {
        // Auto-save already created a draft (or we're in edit mode) — update
        targetId = existingDraftId ?? invoiceId!;
        await updateMutation.mutateAsync({ id: targetId, ...payload });
        if (complete) {
          await completeMutation.mutateAsync({
            id: targetId,
            lineOverrides: [],
          });
          toast.success(
            `Bill "${values.invoiceNumber}" received. Lots and inventory created.`,
          );
        } else {
          toast.success(
            mode === "create"
              ? `Draft bill "${values.invoiceNumber}" saved.`
              : `Draft bill "${values.invoiceNumber}" updated.`,
          );
        }
      }

      // Save aliases for any auto-filled lines not already confirmed via the review panel.
      if (pdfPrefill && values.supplierId && lineVendorNames.length > 0) {
        const aliasesToSave = lineVendorNames.flatMap((vendorName, i) => {
          if (!vendorName) return [];
          if (savedAliasNamesRef.current.has(vendorName)) return [];
          const productId = values.lines[i]?.productId;
          if (!productId) return [];
          return [{ supplierId: values.supplierId, vendorProductName: vendorName, internalProductId: productId }];
        });
        if (aliasesToSave.length > 0) {
          try {
            await saveImportAliasesBatchAction(aliasesToSave);
            const total = aliasesToSave.length + savedAliasNamesRef.current.size;
            toast.success(
              `${total} product alias${total !== 1 ? "es" : ""} saved — future invoices from this supplier will match automatically.`,
            );
          } catch {
            // Non-critical — bill is already saved
          }
        }
      }

      router.push(`/supplier-invoices/${targetId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save invoice.",
      );
    }
  }

  function handleVendorNameResolved(vendorName: string, productId: string) {
    const lineIndex = vendorNameLineMap.get(vendorName);
    if (lineIndex !== undefined) {
      form.setValue(`lines.${lineIndex}.productId`, productId, { shouldValidate: true });
      savedAliasNamesRef.current.add(vendorName);
      if (trulyUnresolvedNames.has(vendorName)) {
        setPdfUnresolvedCount(c => Math.max(0, c - 1));
      }
    }
  }

  return (
    <>
      <form
        id="supplier-invoice-form"
        onSubmit={form.handleSubmit((values) => submit(values, false))}
        style={{ paddingBottom: 80 }}
      >
        {/* Page header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                color: C.ink,
                marginBottom: 6,
              }}
            >
              {mode === "create" ? "Record bill" : "Edit bill"}
            </h1>
            <p style={{ fontSize: 14, color: C.muted, maxWidth: 620 }}>
              {mode === "create"
                ? "Each line you add will create a lot and inventory record when the bill is received. Variable-weight products capture per-case weights below."
                : "Update bill details. Receiving will create lots and inventory for each line."}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexShrink: 0,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {mode === "create" && (
              <>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={handlePdfFileChange}
                />
                <button
                  type="button"
                  onClick={handleReadPdfClick}
                  disabled={isPending}
                  style={{
                    background: C.surface,
                    color: C.ink2,
                    border: `1px solid ${C.line}`,
                    padding: "9px 18px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.6 : 1,
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <FileText style={{ width: 14, height: 14 }} />
                  Read PDF
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => router.push(cancelPath)}
              disabled={isPending}
              style={{
                background: C.surface,
                color: C.ink,
                border: `1px solid ${C.line}`,
                padding: "9px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* ── Ingestion progress panel (replaces spinner during PDF parse) ── */}
        {(parsePdfMutation.isPending || !!parsePdfMutation.error) && (
          <div style={{ marginBottom: 16 }}>
            <IngestionPanel
              fileName={pendingPdfFile?.name ?? "invoice.pdf"}
              fileBytes={pendingPdfFile?.size ?? 0}
              isParsing={parsePdfMutation.isPending}
              parseError={parsePdfMutation.error as Error | null}
              pipelineResult={null}
              onCancel={() => {
                parsePdfMutation.reset();
                setPendingPdfFile(null);
              }}
              onContinuePartial={() => parsePdfMutation.reset()}
              onRetryWithVision={() => {
                parsePdfMutation.reset();
                setPendingPdfFile(null);
                setTimeout(() => pdfInputRef.current?.click(), 100);
              }}
              onDiscard={() => {
                parsePdfMutation.reset();
                setPendingPdfFile(null);
              }}
            />
          </div>
        )}

        {/* ── Bill details card ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <SectionCard
            header={
              <CardTitle
                title="Bill details"
                subtitle="Invoice metadata. Lot numbers and weights are captured per line below."
              />
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                padding: "24px 28px 28px",
              }}
            >
              {/* Supplier */}
              <Controller
                name="supplierId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <label style={lblStyle}>
                      Supplier{" "}
                      <span style={{ color: C.warn, fontWeight: 400 }}>*</span>
                    </label>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={suppliersLoading || isPending}
                    >
                      <SelectTrigger
                        id="si-supplier"
                        aria-invalid={fieldState.invalid}
                        className={inputCls}
                      >
                        <SelectValue
                          placeholder={
                            suppliersLoading
                              ? "Loading…"
                              : "Select supplier…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(suppliers ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </Field>
                )}
              />

              {/* Invoice number */}
              <Controller
                name="invoiceNumber"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <label style={lblStyle}>
                      Invoice number{" "}
                      <span style={{ color: C.warn, fontWeight: 400 }}>*</span>
                    </label>
                    <Input
                      {...field}
                      id="si-number"
                      disabled={isPending}
                      placeholder="e.g. INV-24501"
                      aria-invalid={fieldState.invalid}
                      className={`${inputCls} font-mono`}
                    />
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </Field>
                )}
              />

              {/* Invoice date */}
              <Controller
                name="invoiceDate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <label style={lblStyle}>
                      Invoice date{" "}
                      <span style={{ color: C.warn, fontWeight: 400 }}>*</span>
                    </label>
                    <Input
                      {...field}
                      id="si-invoice-date"
                      type="date"
                      disabled={isPending}
                      aria-invalid={fieldState.invalid}
                      className={`${inputCls} font-mono`}
                    />
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </Field>
                )}
              />

              {/* Receive date */}
              <Controller
                name="receiveDate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <label style={lblStyle}>
                      Receive date{" "}
                      <span style={{ color: C.warn, fontWeight: 400 }}>*</span>
                    </label>
                    <Input
                      {...field}
                      id="si-receive-date"
                      type="date"
                      disabled={isPending}
                      aria-invalid={fieldState.invalid}
                      className={`${inputCls} font-mono`}
                    />
                    <FieldDescription className="text-xs">
                      Lot expirations default to this date + 7 days unless
                      overridden per line.
                    </FieldDescription>
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </Field>
                )}
              />

              {/* Payment method */}
              <Controller
                name="paymentMethod"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <label style={lblStyle}>Payment method</label>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? null : value)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id="si-payment"
                        className={inputCls}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="ach">ACH</SelectItem>
                        <SelectItem value="zelle">Zelle</SelectItem>
                        <SelectItem value="credit_card">
                          Credit card
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Notes (full width) */}
              <Controller
                name="notes"
                control={form.control}
                render={({ field }) => (
                  <Field className="col-span-2">
                    <label style={lblStyle}>Notes</label>
                    <Textarea
                      {...field}
                      id="si-notes"
                      rows={2}
                      placeholder="Internal notes about this shipment…"
                      disabled={isPending}
                      className={`${inputCls} min-h-[76px] resize-y`}
                    />
                  </Field>
                )}
              />
            </div>
          </SectionCard>
        </div>

        {pdfPrefill && (
          <div style={{ marginBottom: 16 }}>
            {pdfPrefill.requiresOcr && (
              <div
                style={{
                  padding: "7px 14px",
                  background: C.surfaceAlt,
                  border: `1px solid ${C.line}`,
                  borderBottom: "none",
                  borderRadius: "10px 10px 0 0",
                  fontSize: 12,
                  color: C.muted,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0, color: C.warn }} />
                <span>Scanned PDF — OCR not yet supported. Results may be incomplete.</span>
              </div>
            )}
            {pdfPrefill.firstBillLines ? (
              <FirstBillPanel
                pipelineResult={pdfPrefill}
                pendingPdfFile={pendingPdfFile}
              />
            ) : (
              <ImportReviewView
                pipelineResult={pdfPrefill}
                products={products ?? []}
                supplierId={watchedSupplierId || null}
                onVendorNameResolved={handleVendorNameResolved}
                chargesTotal={chargesTotal}
                pendingPdfFile={pendingPdfFile}
              />
            )}
          </div>
        )}

        {/* ── Line items card ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {/* Card header with invoice total on right */}
            <div
              style={{
                padding: "20px 28px",
                borderBottom: `1px solid ${C.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 24,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: C.ink,
                    marginBottom: 4,
                  }}
                >
                  Line items
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: C.muted,
                    maxWidth: 600,
                    lineHeight: 1.5,
                  }}
                >
                  Each line creates one lot and inventory record when
                  received. Capture per-case weights to support
                  variable-weight products.
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.mutedSoft,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Invoice total
                </div>
                <div
                  style={{
                    fontFamily: C.mono,
                    fontSize: 24,
                    fontWeight: 600,
                    color: C.ink,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                  }}
                >
                  <LineItemsInvoiceTotal control={form.control} />
                </div>
              </div>
            </div>

            {/* Lines editor (manages its own column headers + rows + footer) */}
            <SupplierInvoiceLinesEditor
              control={form.control}
              register={form.register}
              setValue={form.setValue}
              products={products ?? []}
              productsLoading={productsLoading}
              disabled={isPending}
              vendorProductNames={lineVendorNames.length > 0 ? lineVendorNames : undefined}
              supplierId={watchedSupplierId}
              costDiffByProductId={costDiffByProductId}
              acknowledgedKeys={acknowledgedKeys}
              onToggleAck={toggleAck}
            />

            {form.formState.errors.lines?.message && (
              <div style={{ padding: "0 28px 16px" }}>
                <FieldError className="text-[13px]">
                  {form.formState.errors.lines.message}
                </FieldError>
              </div>
            )}
          </div>
        </div>

        {/* ── Non-inventory charges ─────────────────────────────────────── */}
        <SectionCard
          header={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span>Non-inventory charges</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => appendCharge(emptyCharge())}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                  background: "transparent",
                  color: C.muted,
                  border: `1px solid ${C.line}`,
                }}
              >
                <Plus style={{ width: 11, height: 11 }} />
                Add charge
              </button>
            </div>
          }
        >
          <div style={{ padding: "0 28px 20px" }}>
            {chargeFields.length === 0 ? (
              <div style={{ fontSize: 13, color: C.mutedSoft, padding: "12px 0" }}>
                No charges — freight, fuel surcharges, taxes, and cut fees go here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {/* Column headers */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 110px 80px 110px 76px 28px",
                    gap: 6,
                    paddingBottom: 5,
                    marginBottom: 5,
                    borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  {["Description", "Type", "Rate", "Amount", "In cost", ""].map((h, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.mutedSoft,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: i >= 2 ? "center" : "left",
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {chargeFields.map((field, index) => (
                    <ChargeRow
                      key={field.id}
                      index={index}
                      register={form.register}
                      control={form.control}
                      errors={form.formState.errors.charges?.[index]}
                      onRemove={() => removeCharge(index)}
                      disabled={isPending}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    paddingTop: 10,
                    marginTop: 6,
                    borderTop: `1px solid ${C.line}`,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.ink,
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ color: C.muted, paddingTop: 2 }}>Charges subtotal</span>
                  <ChargesSubtotal control={form.control} />
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Supporting documents ───────────────────────────────────────── */}
        <SupplierInvoiceAttachmentsPlaceholder />
      </form>

      {/* ── Sticky action footer ───────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: sidebarState === "expanded" && !isMobile ? "16rem" : 0,
          right: 0,
          background: C.surface,
          borderTop: `1px solid ${C.line}`,
          zIndex: 10,
          transition: "left 0.2s ease-linear",
        }}
      >
        {blockingChangesCount > 0 ? (
          <div
            style={{
              background: "oklch(95% 0.05 60 / 0.65)",
              borderBottom: `1px solid oklch(60% 0.16 35 / 0.25)`,
              padding: "9px 32px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: C.ink,
            }}
          >
            <AlertTriangle
              style={{
                width: 13,
                height: 13,
                color: "oklch(60% 0.16 35)",
                flexShrink: 0,
              }}
            />
            <span>
              <strong>{blockingChangesCount}</strong> line
              {blockingChangesCount === 1 ? "" : "s"} change recorded supplier
              costs. Acknowledge {blockingChangesCount === 1 ? "it" : "them"} to
              receive.
            </span>
          </div>
        ) : null}
        <div
          style={{
            padding: "14px 32px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
        {/* Auto-save indicator + unresolved PDF warning */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16 }}>
          {pdfPrefill && pdfUnresolvedCount > 0 && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                color: C.warn,
              }}
            >
              <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
              {pdfUnresolvedCount} unresolved product{pdfUnresolvedCount !== 1 ? "s" : ""} — review before posting
            </span>
          )}
          {autoSaveStatus === "saving" && (
            <span style={{ fontSize: 12, color: C.muted }}>Saving…</span>
          )}
          {autoSaveStatus === "saved" && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                color: C.muted,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.good,
                  flexShrink: 0,
                }}
              />
              Draft saved · just now
            </span>
          )}
          {autoSaveStatus === "error" && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                color: C.warn,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.warn,
                  flexShrink: 0,
                }}
              />
              Auto-save failed
            </span>
          )}
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={() => router.push(cancelPath)}
          disabled={isPending}
          style={ghostBtn(isPending)}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={form.handleSubmit((values) => submit(values, false))}
          disabled={isPending || !canEdit}
          title={editDeniedReason}
          style={secondaryBtn(isPending || !canEdit)}
        >
          {isPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={form.handleSubmit((values) => submit(values, true))}
          disabled={
            isPending || !canEdit || !canComplete || blockingChangesCount > 0
          }
          title={
            blockingChangesCount > 0
              ? `Acknowledge ${blockingChangesCount} line${blockingChangesCount === 1 ? "" : "s"} with changed supplier cost first.`
              : (editDeniedReason ?? completeDeniedReason)
          }
          style={primaryBtn(
            isPending || !canEdit || !canComplete || blockingChangesCount > 0,
          )}
        >
          {isPending ? "Posting…" : "Complete & receive"}
        </button>
        </div>
      </div>
    </>
  );
}

// ── Button style helpers ───────────────────────────────────────────────────
function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: C.ink,
    border: `1px solid ${C.line}`,
    padding: "9px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: C.surface,
    color: C.ink,
    border: `1px solid ${C.lineStrong}`,
    padding: "9px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: C.ink,
    color: "#ffffff",
    border: "none",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}
