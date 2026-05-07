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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
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
import { SupplierInvoiceLinesEditor } from "./supplier-invoice-lines-editor";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "#0c0a09",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
} as const;

const controlClassName =
  "border-stone-line bg-stone-surface text-sm text-stone-ink shadow-none";

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
          <Button
            type="button"
            onClick={() => router.push(cancelPath)}
            disabled={isPending}
            variant="outline"
            className="h-8 border-stone-line bg-stone-surface px-3.5 text-[13px] text-stone-ink shadow-none hover:bg-stone-line2 disabled:opacity-60"
          >
            Cancel
          </Button>
        </div>

        {/* Invoice header */}
        <Card className="mb-[18px] gap-0 rounded-[10px] border-stone-line bg-stone-surface p-5 shadow-none ring-0 sm:p-[22px]">
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
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="si-supplier" className="text-xs text-stone-muted">
                    Supplier *
                  </FieldLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={suppliersLoading || isPending}
                  >
                    <SelectTrigger
                      id="si-supplier"
                      aria-invalid={fieldState.invalid}
                      className={controlClassName}
                    >
                      <SelectValue
                        placeholder={suppliersLoading ? "Loading..." : "Select supplier"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers ?? []).map(s => (
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
                  <FieldLabel htmlFor="si-number" className="text-xs text-stone-muted">
                    Invoice number *
                  </FieldLabel>
                  <Input
                    id="si-number"
                    {...field}
                    disabled={isPending}
                    placeholder="e.g. INV-24501"
                    aria-invalid={fieldState.invalid}
                    className={controlClassName}
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
                  <FieldLabel htmlFor="si-invoice-date" className="text-xs text-stone-muted">
                    Invoice date *
                  </FieldLabel>
                  <Input
                    id="si-invoice-date"
                    type="date"
                    {...field}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    className={`${controlClassName} font-mono`}
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
                  <FieldLabel htmlFor="si-receive-date" className="text-xs text-stone-muted">
                    Receive date *
                  </FieldLabel>
                  <Input
                    id="si-receive-date"
                    type="date"
                    {...field}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    className={`${controlClassName} font-mono`}
                  />
                  <FieldDescription className="text-xs">
                    Lot expirations default to this date + 7 days unless overridden per line.
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
                  <FieldLabel htmlFor="si-payment" className="text-xs text-stone-muted">
                    Payment method
                  </FieldLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={value =>
                      field.onChange(value === "none" ? null : value)
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger
                      id="si-payment"
                      className={controlClassName}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="credit_card">Credit card</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Notes */}
            <Controller
              name="notes"
              control={form.control}
              render={({ field }) => (
                <Field className="col-span-2">
                  <FieldLabel htmlFor="si-notes" className="text-xs text-stone-muted">
                    Notes
                  </FieldLabel>
                  <Textarea
                    id="si-notes"
                    rows={2}
                    placeholder="Internal notes about this shipment..."
                    disabled={isPending}
                    {...field}
                    className={`${controlClassName} min-h-[68px] resize-y`}
                  />
                </Field>
              )}
            />
          </div>
        </Card>

        {/* Line items */}
        <Card className="mb-[18px] gap-0 rounded-[10px] border-stone-line bg-stone-surface p-5 shadow-none ring-0 sm:p-[22px]">
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
            <FieldError className="mt-2 text-[13px]">
              {form.formState.errors.lines.message}
            </FieldError>
          )}
        </Card>

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
        <Button
          type="button"
          onClick={() => router.push(cancelPath)}
          disabled={isPending}
          variant="outline"
          className="h-8 border-stone-line bg-stone-surface px-3.5 text-[13px] text-stone-ink shadow-none hover:bg-stone-line2 disabled:opacity-60"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={form.handleSubmit(values => submit(values, false))}
          disabled={isPending || !canEdit}
          title={editDeniedReason}
          variant="outline"
          className="h-8 border-stone-line bg-stone-surface px-3.5 text-[13px] text-stone-ink shadow-none hover:bg-stone-line2 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="button"
          onClick={form.handleSubmit(values => submit(values, true))}
          disabled={isPending || !canEdit || !canComplete}
          title={editDeniedReason ?? completeDeniedReason}
          className="h-8 border-stone-ink bg-stone-ink px-3.5 text-[13px] text-stone-surface hover:bg-stone-ink/90 disabled:opacity-60"
        >
          {isPending ? "Posting…" : "Complete & receive"}
        </Button>
      </div>
    </>
  );
}
