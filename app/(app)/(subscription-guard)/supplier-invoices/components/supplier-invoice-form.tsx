"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import { useProducts } from "@/hooks/use-products";
import { useSuppliers } from "@/hooks/use-suppliers";
import {
  computeDraftLineWeight,
  serializeDraftCaseWeights,
} from "@/lib/supplier-invoices/case-weights";
import {
  useCreateSupplierInvoice,
  useUpdateSupplierInvoice,
  useCompleteSupplierInvoice,
} from "@/hooks/use-supplier-invoices";
import { can, getPermissionDeniedReason } from "@/lib/auth/permissions";

import { SupplierInvoiceAttachmentsPlaceholder } from "./supplier-invoice-attachments-placeholder";
import {
  emptyLine,
  supplierInvoiceFormSchema,
  type SupplierInvoiceFormValues,
} from "./supplier-invoice-form.schema";
import { SupplierInvoiceLinesEditor } from "./supplier-invoice-lines-editor";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "#0c0a09",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  err: "oklch(55% 0.22 25)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

const outlineBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: C.radiusSm,
  border: `1px solid ${C.line}`,
  background: C.surface,
  color: C.ink,
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const primaryBtn: React.CSSProperties = {
  ...outlineBtn,
  background: C.ink,
  color: "#fafaf9",
  borderColor: C.ink,
};

const fieldBase: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: `1px solid ${C.line}`,
  borderRadius: C.radiusSm,
  background: C.surface,
  fontSize: "14px",
  color: C.ink,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
};

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

// ── Component ──────────────────────────────────────────────────────────────

export function SupplierInvoiceForm({ mode, invoiceId, initialValues }: Props) {
  const router = useRouter();
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

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    completeMutation.isPending;

  const cancelPath = invoiceId
    ? `/supplier-invoices/${invoiceId}`
    : "/supplier-invoices";

  async function submit(values: SupplierInvoiceFormValues, complete: boolean) {
    const normalizedLines = values.lines.map(line => ({
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

    try {
      if (mode === "create") {
        const result = await createMutation.mutateAsync({
          supplierId: values.supplierId,
          invoiceNumber: values.invoiceNumber,
          invoiceDate: values.invoiceDate,
          receiveDate: values.receiveDate,
          paymentMethod: values.paymentMethod ?? null,
          notes: values.notes || null,
          lines: normalizedLines,
          complete,
        });
        toast.success(
          complete
            ? `Invoice "${values.invoiceNumber}" posted. Lots and inventory created.`
            : `Draft invoice "${values.invoiceNumber}" saved.`,
        );
        router.push(`/supplier-invoices/${result.id}`);
      } else if (invoiceId) {
        await updateMutation.mutateAsync({
          id: invoiceId,
          supplierId: values.supplierId,
          invoiceNumber: values.invoiceNumber,
          invoiceDate: values.invoiceDate,
          receiveDate: values.receiveDate,
          paymentMethod: values.paymentMethod ?? null,
          notes: values.notes || null,
          lines: normalizedLines,
        });
        if (complete) {
          await completeMutation.mutateAsync({
            id: invoiceId,
            lineOverrides: normalizedLines
              .filter(l => l.id)
              .map(l => ({
                lineId: l.id!,
                lotNumberOverride: l.lotNumberOverride,
                expirationDateOverride: l.expirationDateOverride,
              })),
          });
          toast.success(
            `Invoice "${values.invoiceNumber}" posted. Lots and inventory created.`,
          );
        } else {
          toast.success(`Draft "${values.invoiceNumber}" updated.`);
        }
        router.push(`/supplier-invoices/${invoiceId}`);
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
        onSubmit={form.handleSubmit(values => submit(values, false))}
        style={{ paddingBottom: "72px" }}
      >
        {/* Page header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "24px",
            paddingBottom: "22px",
            borderBottom: `1px solid ${C.line}`,
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: C.ink,
              }}
            >
              {mode === "create" ? "New supplier invoice" : "Edit supplier invoice"}
            </div>
            <div style={{ fontSize: "13px", color: C.muted, marginTop: "4px" }}>
              {mode === "create"
                ? "Save a draft while gathering details, or complete to auto-generate lots and inventory."
                : "Update invoice details. Completing will auto-create lots and inventory."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(cancelPath)}
            disabled={isPending}
            style={{ ...outlineBtn, opacity: isPending ? 0.6 : 1 }}
          >
            Cancel
          </button>
        </div>

        {/* Invoice header */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: C.radius,
            padding: "20px 22px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: C.ink,
              marginBottom: "16px",
            }}
          >
            Invoice header
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
            }}
          >
            {/* Supplier */}
            <Controller
              name="supplierId"
              control={form.control}
              render={({ field, fieldState }) => (
                <div>
                  <label
                    htmlFor="si-supplier"
                    style={{ fontSize: "12px", color: C.muted, fontWeight: 500, display: "block", marginBottom: "5px" }}
                  >
                    Supplier *
                  </label>
                  <select
                    id="si-supplier"
                    value={field.value || ""}
                    onChange={e => field.onChange(e.target.value)}
                    disabled={suppliersLoading || isPending}
                    aria-invalid={fieldState.invalid}
                    style={{
                      ...fieldBase,
                      borderColor: fieldState.invalid ? C.err : C.line,
                      cursor: "pointer",
                    }}
                  >
                    <option value="">
                      {suppliersLoading ? "Loading..." : "Select supplier"}
                    </option>
                    {(suppliers ?? []).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {fieldState.invalid && (
                    <span style={{ fontSize: "12px", color: C.err, marginTop: "4px", display: "block" }}>
                      {fieldState.error?.message}
                    </span>
                  )}
                </div>
              )}
            />

            {/* Invoice number */}
            <Controller
              name="invoiceNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <div>
                  <label
                    htmlFor="si-number"
                    style={{ fontSize: "12px", color: C.muted, fontWeight: 500, display: "block", marginBottom: "5px" }}
                  >
                    Invoice number *
                  </label>
                  <input
                    id="si-number"
                    {...field}
                    disabled={isPending}
                    placeholder="e.g. INV-24501"
                    aria-invalid={fieldState.invalid}
                    style={{
                      ...fieldBase,
                      borderColor: fieldState.invalid ? C.err : C.line,
                    }}
                  />
                  {fieldState.invalid && (
                    <span style={{ fontSize: "12px", color: C.err, marginTop: "4px", display: "block" }}>
                      {fieldState.error?.message}
                    </span>
                  )}
                </div>
              )}
            />

            {/* Invoice date */}
            <Controller
              name="invoiceDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <div>
                  <label
                    htmlFor="si-invoice-date"
                    style={{ fontSize: "12px", color: C.muted, fontWeight: 500, display: "block", marginBottom: "5px" }}
                  >
                    Invoice date *
                  </label>
                  <input
                    id="si-invoice-date"
                    type="date"
                    {...field}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    style={{
                      ...fieldBase,
                      fontFamily: C.mono,
                      borderColor: fieldState.invalid ? C.err : C.line,
                    }}
                  />
                  {fieldState.invalid && (
                    <span style={{ fontSize: "12px", color: C.err, marginTop: "4px", display: "block" }}>
                      {fieldState.error?.message}
                    </span>
                  )}
                </div>
              )}
            />

            {/* Receive date */}
            <Controller
              name="receiveDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <div>
                  <label
                    htmlFor="si-receive-date"
                    style={{ fontSize: "12px", color: C.muted, fontWeight: 500, display: "block", marginBottom: "5px" }}
                  >
                    Receive date *
                  </label>
                  <input
                    id="si-receive-date"
                    type="date"
                    {...field}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    style={{
                      ...fieldBase,
                      fontFamily: C.mono,
                      borderColor: fieldState.invalid ? C.err : C.line,
                    }}
                  />
                  <span style={{ fontSize: "12px", color: C.muted, marginTop: "4px", display: "block" }}>
                    Lot expirations default to this date + 7 days unless overridden per line.
                  </span>
                  {fieldState.invalid && (
                    <span style={{ fontSize: "12px", color: C.err, marginTop: "2px", display: "block" }}>
                      {fieldState.error?.message}
                    </span>
                  )}
                </div>
              )}
            />

            {/* Payment method */}
            <Controller
              name="paymentMethod"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label
                    htmlFor="si-payment"
                    style={{ fontSize: "12px", color: C.muted, fontWeight: 500, display: "block", marginBottom: "5px" }}
                  >
                    Payment method
                  </label>
                  <select
                    id="si-payment"
                    value={field.value ?? "none"}
                    onChange={e =>
                      field.onChange(e.target.value === "none" ? null : e.target.value)
                    }
                    disabled={isPending}
                    style={{ ...fieldBase, cursor: "pointer" }}
                  >
                    <option value="none">Not specified</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="ach">ACH</option>
                    <option value="zelle">Zelle</option>
                    <option value="credit_card">Credit card</option>
                  </select>
                </div>
              )}
            />

            {/* Notes */}
            <Controller
              name="notes"
              control={form.control}
              render={({ field }) => (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label
                    htmlFor="si-notes"
                    style={{ fontSize: "12px", color: C.muted, fontWeight: 500, display: "block", marginBottom: "5px" }}
                  >
                    Notes
                  </label>
                  <textarea
                    id="si-notes"
                    rows={2}
                    placeholder="Internal notes about this shipment..."
                    disabled={isPending}
                    {...field}
                    style={{ ...fieldBase, resize: "vertical" }}
                  />
                </div>
              )}
            />
          </div>
        </div>

        {/* Line items */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: C.radius,
            padding: "20px 22px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{ fontSize: "13px", fontWeight: 600, color: C.ink, marginBottom: "4px" }}
          >
            Line items
          </div>
          <div style={{ fontSize: "13px", color: C.muted, marginBottom: "16px" }}>
            Each line becomes one lot and one inventory record when the invoice is
            completed.
          </div>
          <SupplierInvoiceLinesEditor
            control={form.control}
            register={form.register}
            setValue={form.setValue}
            products={products ?? []}
            productsLoading={productsLoading}
            disabled={isPending}
          />
          {form.formState.errors.lines?.message && (
            <p style={{ fontSize: "13px", color: C.err, marginTop: "8px" }}>
              {form.formState.errors.lines.message}
            </p>
          )}
        </div>

        <SupplierInvoiceAttachmentsPlaceholder />
      </form>

      {/* Sticky action bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: C.surface,
          borderTop: `1px solid ${C.line}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          zIndex: 40,
        }}
      >
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => router.push(cancelPath)}
          disabled={isPending}
          style={{ ...outlineBtn, opacity: isPending ? 0.6 : 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={form.handleSubmit(values => submit(values, false))}
          disabled={isPending || !canEdit}
          title={editDeniedReason}
          style={{ ...outlineBtn, opacity: isPending || !canEdit ? 0.6 : 1 }}
        >
          {isPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={form.handleSubmit(values => submit(values, true))}
          disabled={isPending || !canEdit || !canComplete}
          title={editDeniedReason ?? completeDeniedReason}
          style={{
            ...primaryBtn,
            opacity: isPending || !canEdit || !canComplete ? 0.6 : 1,
          }}
        >
          {isPending ? "Posting…" : "Complete & receive →"}
        </button>
      </div>
    </>
  );
}
