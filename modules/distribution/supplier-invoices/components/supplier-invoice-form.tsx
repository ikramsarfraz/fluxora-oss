"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

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
  useNextSupplierInvoiceNumber,
  useSupplierCostDiffContext,
} from "../hooks/use-supplier-invoices";
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
  emptyLine,
  supplierInvoiceFormSchema,
  type SupplierInvoiceFormValues,
} from "./supplier-invoice-form.schema";
import {
  ackKey as makeAckKey,
  LineItemsInvoiceTotal,
  SupplierInvoiceLinesEditor,
  type LineCostAckKey,
} from "./supplier-invoice-lines-editor";

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

// ── Types ──────────────────────────────────────────────────────────────────
type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  invoiceId?: string;
  initialValues?: SupplierInvoiceFormValues;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
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
export function SupplierInvoiceForm({ mode, invoiceId, initialValues }: Props) {
  const router = useRouter();
  const { state: sidebarState, isMobile } = useSidebar();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: products, isLoading: productsLoading } = useProducts();

  const createMutation = useCreateSupplierInvoice();
  const updateMutation = useUpdateSupplierInvoice();
  const completeMutation = useCompleteSupplierInvoice();
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
    completeMutation.isPending;

  // ── Live cost-diff context (drives the per-line callout + Complete gate) ──
  const watchedSupplierId = useWatch({ control: form.control, name: "supplierId" }) ?? "";
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
    };

    const existingDraftId = draftIdRef.current;

    try {
      if (mode === "create" && !existingDraftId) {
        // No auto-save draft yet — create fresh
        const result = await createMutation.mutateAsync({
          ...payload,
          complete,
        });
        draftIdRef.current = result.id;
        toast.success(
          complete
            ? `Bill "${values.invoiceNumber}" received. Lots and inventory created.`
            : `Draft bill "${values.invoiceNumber}" saved.`,
        );
        router.push(`/supplier-invoices/${result.id}`);
      } else {
        // Auto-save already created a draft (or we're in edit mode) — update
        const targetId = existingDraftId ?? invoiceId!;
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
        router.push(`/supplier-invoices/${targetId}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save invoice.",
      );
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
        {/* Auto-save indicator */}
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
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
