"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, Receipt } from "lucide-react";
import { toast } from "sonner";

import { useRecordPaymentForSalesOrderInvoice } from "../hooks/use-orders";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { can, getPermissionDeniedReason } from "@/lib/auth/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { randomId } from "@/lib/random-id";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/modules/shared/utils/payment-methods";

import type { SalesOrderDetail } from "../services/orders";

interface OrderPaymentEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SalesOrderDetail;
}

interface PaymentFormValues {
  salesInvoiceId: string;
  paymentDate: string;
  amount: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  checkNumber: string;
  notes: string;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getOpenInvoices(order: SalesOrderDetail) {
  return (order.invoices ?? [])
    .map(invoice => ({
      ...invoice,
      numericBalanceDue: parseFloat(invoice.balanceDue ?? "0") || 0,
    }))
    .filter(invoice => invoice.numericBalanceDue > 0)
    .sort(
      (a, b) =>
        new Date(b.invoiceDate ?? b.createdAt).getTime() -
        new Date(a.invoiceDate ?? a.createdAt).getTime(),
    );
}

function makeDefaultValues(order: SalesOrderDetail): PaymentFormValues {
  const [latestOpenInvoice] = getOpenInvoices(order);
  const suggestedAmount = latestOpenInvoice
    ? (parseFloat(latestOpenInvoice.balanceDue ?? "0") || 0).toFixed(2)
    : "";

  return {
    salesInvoiceId: latestOpenInvoice?.id ?? "",
    paymentDate: todayString(),
    amount: suggestedAmount,
    paymentMethod: "ach",
    referenceNumber: "",
    checkNumber: "",
    notes: "",
  };
}

export function OrderPaymentEntryDialog({
  open,
  onOpenChange,
  order,
}: OrderPaymentEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Apply a payment to an open invoice from this sales order. Paid
            amount, balance due, and payment status will refresh automatically.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <PaymentBody order={order} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PaymentBody({
  order,
  onClose,
}: {
  order: SalesOrderDetail;
  onClose: () => void;
}) {
  const recordPayment = useRecordPaymentForSalesOrderInvoice();
  const { data: currentUser } = useCurrentPortalUser();
  const canRecord = can(currentUser?.role, "record_payment");
  const recordDeniedReason = canRecord
    ? null
    : getPermissionDeniedReason("record_payment");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // One key per dialog mount — survives submit retries so a request
  // that succeeded server-side but lost its response is recognized.
  const idempotencyKey = useMemo(() => randomId(), []);

  const openInvoices = useMemo(() => getOpenInvoices(order), [order]);
  const invoiceLookup = useMemo(
    () => new Map(openInvoices.map(invoice => [invoice.id, invoice])),
    [openInvoices],
  );

  const {
    control,
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    defaultValues: makeDefaultValues(order),
  });

  const selectedInvoiceId = useWatch({ control, name: "salesInvoiceId" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const selectedInvoice = selectedInvoiceId
    ? invoiceLookup.get(selectedInvoiceId)
    : undefined;
  const selectedBalanceDue = selectedInvoice
    ? parseFloat(selectedInvoice.balanceDue ?? "0") || 0
    : 0;

  async function onSubmit(values: PaymentFormValues) {
    try {
      setSubmitError(null);
      await recordPayment.mutateAsync({
        salesOrderId: order.id,
        salesInvoiceId: values.salesInvoiceId,
        paymentDate: values.paymentDate,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        checkNumber: values.checkNumber.trim() || undefined,
        referenceNumber: values.referenceNumber.trim() || undefined,
        notes: values.notes.trim() || undefined,
        idempotencyKey,
      });
      toast.success("Payment recorded.");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not record payment.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <>
      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not record payment</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : recordDeniedReason ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Recording payment is not available</AlertTitle>
          <AlertDescription>{recordDeniedReason}</AlertDescription>
        </Alert>
      ) : null}

      {openInvoices.length === 0 ? (
        <Alert>
          <Receipt />
          <AlertTitle>No open invoices</AlertTitle>
          <AlertDescription>
            This order does not have an invoice with a remaining balance due.
          </AlertDescription>
        </Alert>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={event => void handleSubmit(onSubmit)(event)}
        >
          <Field>
            <FieldLabel htmlFor="payment-sales-invoice">Invoice</FieldLabel>
            <Controller
              control={control}
              name="salesInvoiceId"
              rules={{ required: "Select an invoice." }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={value => {
                    field.onChange(value);
                    const invoice = invoiceLookup.get(value);
                    if (invoice) {
                      setValue(
                        "amount",
                        (parseFloat(invoice.balanceDue ?? "0") || 0).toFixed(2),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }
                  }}
                >
                  <SelectTrigger id="payment-sales-invoice">
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {openInvoices.map(invoice => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} · Due{" "}
                        {formatMoney(invoice.numericBalanceDue)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.salesInvoiceId]} />
            {selectedInvoice ? (
              <FieldDescription>
                {selectedInvoice.status.replaceAll("_", " ")} · Dated{" "}
                {formatDisplayDate(selectedInvoice.invoiceDate)} · Balance due{" "}
                {formatMoney(selectedBalanceDue)}
              </FieldDescription>
            ) : null}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payment-date">Payment date</FieldLabel>
              <Input
                id="payment-date"
                type="date"
                {...register("paymentDate", {
                  required: "Enter a payment date.",
                })}
              />
              <FieldError errors={[errors.paymentDate]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
              <Input
                id="payment-amount"
                inputMode="decimal"
                placeholder="0.00"
                {...register("amount", {
                  required: "Enter a payment amount.",
                  validate: value => {
                    const amount = Number(value);
                    if (!Number.isFinite(amount) || amount <= 0) {
                      return "Payment amount must be greater than 0.";
                    }
                    if (!selectedInvoice) return "Select an invoice.";
                    if (amount - selectedBalanceDue > 0.01) {
                      return `Amount cannot exceed ${formatMoney(selectedBalanceDue)}.`;
                    }
                    return true;
                  },
                })}
              />
              <FieldError errors={[errors.amount]} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payment-method">Payment method</FieldLabel>
              <Controller
                control={control}
                name="paymentMethod"
                rules={{ required: "Select a payment method." }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="payment-method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.paymentMethod]} />
            </Field>

            {paymentMethod === "check" ? (
              <Field>
                <FieldLabel htmlFor="payment-check-number">Check number</FieldLabel>
                <Input
                  id="payment-check-number"
                  placeholder="e.g. 1042"
                  {...register("checkNumber")}
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="payment-reference">
                  Reference number
                </FieldLabel>
                <Input
                  id="payment-reference"
                  placeholder="Optional confirmation / memo"
                  {...register("referenceNumber")}
                />
              </Field>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="payment-notes">Notes</FieldLabel>
            <Textarea
              id="payment-notes"
              rows={3}
              placeholder="Optional note about remittance, customer communication, or applied detail…"
              {...register("notes")}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                recordPayment.isPending ||
                openInvoices.length === 0 ||
                !canRecord
              }
              title={recordDeniedReason ?? undefined}
            >
              <Receipt className="h-4 w-4" />
              {recordPayment.isPending ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}
