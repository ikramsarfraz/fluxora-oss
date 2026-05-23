"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, Receipt } from "lucide-react";
import { toast } from "sonner";

import { useRecordPaymentForSalesOrderInvoice } from "@/modules/distribution/orders/hooks/use-orders";
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
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/modules/shared";

interface PaymentFormValues {
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    salesOrderId: string;
    invoiceNumber: string;
    invoiceDate: string | null;
    status: string;
    balanceDue: string;
  };
}

/**
 * Record-payment dialog scoped to a single invoice. Used from the invoice
 * detail page so the user doesn't have to navigate to the parent sales order
 * to apply a payment. Calls the same recordPaymentForSalesOrderInvoice
 * service as the order-level dialog, so audit + permission checks stay
 * consistent across surfaces.
 */
export function InvoicePaymentEntryDialog({ open, onOpenChange, invoice }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Apply a payment to invoice{" "}
            <strong className="font-mono">{invoice.invoiceNumber}</strong>.
            Balance due, status, and the AR aging buckets refresh
            automatically.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <PaymentBody invoice={invoice} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PaymentBody({
  invoice,
  onClose,
}: {
  invoice: Props["invoice"];
  onClose: () => void;
}) {
  const recordPayment = useRecordPaymentForSalesOrderInvoice();
  const { data: currentUser } = useCurrentPortalUser();
  const canRecord = can(currentUser?.role, "record_payment");
  // One key per dialog mount — survives submit retries so a request
  // that succeeded server-side but lost its response is recognized.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const recordDeniedReason = canRecord
    ? null
    : getPermissionDeniedReason("record_payment");

  const [submitError, setSubmitError] = useState<string | null>(null);

  const balanceDue = parseFloat(invoice.balanceDue ?? "0") || 0;

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    defaultValues: {
      paymentDate: todayString(),
      amount: balanceDue.toFixed(2),
      paymentMethod: "ach",
      referenceNumber: "",
      checkNumber: "",
      notes: "",
    },
  });

  const paymentMethod = useWatch({ control, name: "paymentMethod" });

  async function onSubmit(values: PaymentFormValues) {
    try {
      setSubmitError(null);
      await recordPayment.mutateAsync({
        salesOrderId: invoice.salesOrderId,
        salesInvoiceId: invoice.id,
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
      ) : balanceDue <= 0 ? (
        <Alert>
          <Receipt />
          <AlertTitle>Nothing to record</AlertTitle>
          <AlertDescription>
            This invoice is already paid in full.
          </AlertDescription>
        </Alert>
      ) : null}

      {balanceDue > 0 ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={event => void handleSubmit(onSubmit)(event)}
        >
          <FieldDescription>
            {invoice.invoiceDate
              ? `Dated ${formatDisplayDate(invoice.invoiceDate)} · `
              : ""}
            Balance due {formatMoney(balanceDue)}
          </FieldDescription>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="invoice-payment-date">Payment date</FieldLabel>
              <Input
                id="invoice-payment-date"
                type="date"
                {...register("paymentDate", {
                  required: "Enter a payment date.",
                })}
              />
              <FieldError errors={[errors.paymentDate]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="invoice-payment-amount">Amount</FieldLabel>
              <Input
                id="invoice-payment-amount"
                inputMode="decimal"
                placeholder="0.00"
                {...register("amount", {
                  required: "Enter a payment amount.",
                  validate: value => {
                    const amount = Number(value);
                    if (!Number.isFinite(amount) || amount <= 0) {
                      return "Payment amount must be greater than 0.";
                    }
                    if (amount - balanceDue > 0.01) {
                      return `Amount cannot exceed ${formatMoney(balanceDue)}.`;
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
              <FieldLabel htmlFor="invoice-payment-method">Payment method</FieldLabel>
              <Controller
                control={control}
                name="paymentMethod"
                rules={{ required: "Select a payment method." }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="invoice-payment-method">
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

            <Field>
              <FieldLabel htmlFor="invoice-payment-reference">
                Reference number
              </FieldLabel>
              <Input
                id="invoice-payment-reference"
                placeholder="Optional reference"
                {...register("referenceNumber")}
              />
            </Field>
          </div>

          {paymentMethod === "check" ? (
            <Field>
              <FieldLabel htmlFor="invoice-payment-check-number">
                Check number
              </FieldLabel>
              <Input
                id="invoice-payment-check-number"
                placeholder="Check number"
                {...register("checkNumber")}
              />
              <FieldDescription>
                Stored separately from the reference number for accounting
                exports.
              </FieldDescription>
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="invoice-payment-notes">Notes</FieldLabel>
            <Textarea
              id="invoice-payment-notes"
              rows={3}
              placeholder="Optional note about remittance or applied detail…"
              {...register("notes")}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={recordPayment.isPending || !canRecord}
              title={recordDeniedReason ?? undefined}
            >
              <Receipt className="h-4 w-4" />
              {recordPayment.isPending ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </>
  );
}
