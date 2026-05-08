"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { AlertCircle, Receipt } from "lucide-react";
import { toast } from "sonner";

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
import { useRecordSupplierInvoicePayment } from "../hooks/use-supplier-invoices";
import { formatMoney } from "@/lib/utils/currency";

type PaymentMethod = "cash" | "check" | "ach" | "zelle" | "credit_card";

interface SupplierInvoicePaymentEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierInvoiceId: string;
  invoiceNumber: string;
  balanceDue: string;
  defaultPaymentMethod?: PaymentMethod | null;
}

interface PaymentFormValues {
  paymentDate: string;
  amount: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
}

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH" },
  { value: "zelle", label: "Zelle" },
  { value: "credit_card", label: "Credit card" },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function makeDefaults(
  balanceDue: string,
  defaultPaymentMethod: PaymentMethod | null | undefined,
): PaymentFormValues {
  const suggested = Number(balanceDue);
  return {
    paymentDate: todayString(),
    amount:
      Number.isFinite(suggested) && suggested > 0 ? suggested.toFixed(2) : "",
    paymentMethod: defaultPaymentMethod ?? "ach",
    reference: "",
    notes: "",
  };
}

export function SupplierInvoicePaymentEntryDialog({
  open,
  onOpenChange,
  supplierInvoiceId,
  invoiceNumber,
  balanceDue,
  defaultPaymentMethod,
}: SupplierInvoicePaymentEntryDialogProps) {
  const numericBalanceDue = Number(balanceDue) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Apply a payment to {invoiceNumber}. Balance due:{" "}
            <strong>{formatMoney(numericBalanceDue)}</strong>.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <PaymentForm
            supplierInvoiceId={supplierInvoiceId}
            invoiceNumber={invoiceNumber}
            balanceDue={balanceDue}
            defaultPaymentMethod={defaultPaymentMethod}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  supplierInvoiceId,
  invoiceNumber,
  balanceDue,
  defaultPaymentMethod,
  onClose,
}: {
  supplierInvoiceId: string;
  invoiceNumber: string;
  balanceDue: string;
  defaultPaymentMethod: PaymentMethod | null | undefined;
  onClose: () => void;
}) {
  const recordPayment = useRecordSupplierInvoicePayment();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    defaultValues: makeDefaults(balanceDue, defaultPaymentMethod),
  });

  const numericBalanceDue = Number(balanceDue) || 0;

  async function onSubmit(values: PaymentFormValues) {
    try {
      setSubmitError(null);
      await recordPayment.mutateAsync({
        supplierInvoiceId,
        paymentDate: values.paymentDate,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        reference: values.reference.trim() || null,
        notes: values.notes.trim() || null,
      });
      toast.success(`Payment recorded on ${invoiceNumber}.`);
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
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={event => void handleSubmit(onSubmit)(event)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="si-payment-date">Payment date</FieldLabel>
            <Input
              id="si-payment-date"
              type="date"
              {...register("paymentDate", {
                required: "Enter a payment date.",
              })}
            />
            <FieldError errors={[errors.paymentDate]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="si-payment-amount">Amount</FieldLabel>
            <Input
              id="si-payment-amount"
              inputMode="decimal"
              placeholder="0.00"
              {...register("amount", {
                required: "Enter a payment amount.",
                validate: value => {
                  const amount = Number(value);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    return "Payment amount must be greater than 0.";
                  }
                  if (amount - numericBalanceDue > 0.01) {
                    return `Amount cannot exceed ${formatMoney(numericBalanceDue)}.`;
                  }
                  return true;
                },
              })}
            />
            <FieldError errors={[errors.amount]} />
            <FieldDescription>
              Up to {formatMoney(numericBalanceDue)} remaining on this invoice.
            </FieldDescription>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="si-payment-method">Payment method</FieldLabel>
            <Controller
              control={control}
              name="paymentMethod"
              rules={{ required: "Select a payment method." }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="si-payment-method">
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
            <FieldLabel htmlFor="si-payment-reference">Reference</FieldLabel>
            <Input
              id="si-payment-reference"
              placeholder="Check #, ACH id, etc."
              {...register("reference")}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="si-payment-notes">Notes</FieldLabel>
          <Textarea
            id="si-payment-notes"
            rows={3}
            placeholder="Optional note (remittance detail, supplier confirmation, etc.)"
            {...register("notes")}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={recordPayment.isPending || numericBalanceDue <= 0.005}
          >
            <Receipt className="h-4 w-4" />
            {recordPayment.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
