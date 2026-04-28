"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
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

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  invoiceId?: string;
  initialValues?: SupplierInvoiceFormValues;
};

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
    <form
      id="supplier-invoice-form"
      onSubmit={form.handleSubmit(values => submit(values, false))}
      className="flex flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice header</CardTitle>
          <CardDescription>
            Who sent the invoice, which PO number is on it, and when you
            received the shipment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Controller
              name="supplierId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="si-supplier">Supplier *</FieldLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    disabled={suppliersLoading || isPending}
                  >
                    <SelectTrigger
                      id="si-supplier"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue
                        placeholder={
                          suppliersLoading ? "Loading..." : "Select supplier"
                        }
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
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="invoiceNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="si-number">Invoice number *</FieldLabel>
                  <Input
                    id="si-number"
                    {...field}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. INV-24501"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="invoiceDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="si-invoice-date">
                    Invoice date *
                  </FieldLabel>
                  <Input
                    id="si-invoice-date"
                    type="date"
                    {...field}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="receiveDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="si-receive-date">
                    Receive date *
                  </FieldLabel>
                  <Input
                    id="si-receive-date"
                    type="date"
                    {...field}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Lot expirations default to this date + 7 days unless
                    overridden per line.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="paymentMethod"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="si-payment">Payment method</FieldLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={v =>
                      field.onChange(v === "none" ? null : v)
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="si-payment">
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

            <Controller
              name="notes"
              control={form.control}
              render={({ field }) => (
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="si-notes">Notes</FieldLabel>
                  <Textarea
                    id="si-notes"
                    rows={2}
                    placeholder="Internal notes about this shipment..."
                    disabled={isPending}
                    {...field}
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
          <CardDescription>
            Each line becomes one lot and one inventory record when the invoice
            is completed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierInvoiceLinesEditor
            control={form.control}
            register={form.register}
            setValue={form.setValue}
            products={products ?? []}
            productsLoading={productsLoading}
            disabled={isPending}
          />
          {form.formState.errors.lines?.message && (
            <p className="text-destructive mt-2 text-sm">
              {form.formState.errors.lines.message}
            </p>
          )}
        </CardContent>
      </Card>

      <SupplierInvoiceAttachmentsPlaceholder />

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/supplier-invoices")}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="secondary"
          disabled={isPending || !canEdit}
          title={editDeniedReason}
        >
          {isPending
            ? "Saving..."
            : mode === "create"
              ? "Save draft"
              : "Save draft"}
        </Button>
        <Button
          type="button"
          disabled={isPending || !canEdit || !canComplete}
          title={editDeniedReason ?? completeDeniedReason}
          onClick={form.handleSubmit(values => submit(values, true))}
        >
          {isPending ? "Posting..." : "Complete & receive"}
        </Button>
      </div>
    </form>
  );
}
