"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, Receipt } from "lucide-react";
import { toast } from "sonner";

import { useUpdatePayment } from "../hooks/use-payments";
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
import type { PaymentDetail, PaymentMethod } from "../services/payments";

interface FormValues {
  paymentDate: string;
  amount: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  checkNumber: string;
  notes: string;
}

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH" },
  { value: "zelle", label: "Zelle" },
  { value: "credit_card", label: "Credit card" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentDetail;
}

/**
 * Edit dialog for an existing payment. Lets the user fix the date, amount,
 * method, reference, check number, or notes. The amount edit is
 * server-side-bounded by the invoice's grand total minus the sum of
 * *other* payments on the same invoice, so the user can't accidentally
 * overpay.
 */
export function PaymentEditDialog({ open, onOpenChange, payment }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
          <DialogDescription>
            Update the payment details. Invoice totals and AR aging refresh
            automatically.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <Body payment={payment} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  payment,
  onClose,
}: {
  payment: PaymentDetail;
  onClose: () => void;
}) {
  const updatePayment = useUpdatePayment();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const invoice = payment.salesInvoice;
  const totalAmount = Number(invoice?.totalAmount ?? 0);
  const otherSum = (invoice?.payments ?? [])
    .filter(p => p.id !== payment.id)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const maxAmount = Math.max(totalAmount - otherSum, 0);

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      paymentDate: payment.paymentDate,
      amount: Number(payment.amount).toFixed(2),
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber ?? "",
      checkNumber: payment.checkNumber ?? "",
      notes: payment.notes ?? "",
    },
  });

  const paymentMethod = useWatch({ control, name: "paymentMethod" });

  async function onSubmit(values: FormValues) {
    try {
      setSubmitError(null);
      await updatePayment.mutateAsync({
        id: payment.id,
        paymentDate: values.paymentDate,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        checkNumber: values.checkNumber.trim() || null,
        referenceNumber: values.referenceNumber.trim() || null,
        notes: values.notes.trim() || null,
      });
      toast.success("Payment updated.");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update payment.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <>
      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not update payment</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={event => void handleSubmit(onSubmit)(event)}
      >
        <FieldDescription>
          Max applicable to this invoice: {formatMoney(maxAmount)} ({formatMoney(otherSum)} already applied via other payments)
        </FieldDescription>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="payment-edit-date">Payment date</FieldLabel>
            <Input
              id="payment-edit-date"
              type="date"
              {...register("paymentDate", {
                required: "Enter a payment date.",
              })}
            />
            <FieldError errors={[errors.paymentDate]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="payment-edit-amount">Amount</FieldLabel>
            <Input
              id="payment-edit-amount"
              inputMode="decimal"
              {...register("amount", {
                required: "Enter an amount.",
                validate: value => {
                  const amount = Number(value);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    return "Amount must be greater than 0.";
                  }
                  if (amount - maxAmount > 0.01) {
                    return `Amount cannot exceed ${formatMoney(maxAmount)}.`;
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
            <FieldLabel htmlFor="payment-edit-method">Payment method</FieldLabel>
            <Controller
              control={control}
              name="paymentMethod"
              rules={{ required: "Select a payment method." }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="payment-edit-method">
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
            <FieldLabel htmlFor="payment-edit-reference">Reference number</FieldLabel>
            <Input
              id="payment-edit-reference"
              placeholder="Optional reference"
              {...register("referenceNumber")}
            />
          </Field>
        </div>

        {paymentMethod === "check" ? (
          <Field>
            <FieldLabel htmlFor="payment-edit-check-number">Check number</FieldLabel>
            <Input
              id="payment-edit-check-number"
              placeholder="Check number"
              {...register("checkNumber")}
            />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="payment-edit-notes">Notes</FieldLabel>
          <Textarea
            id="payment-edit-notes"
            rows={3}
            placeholder="Optional notes…"
            {...register("notes")}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={updatePayment.isPending}>
            <Receipt className="h-4 w-4" />
            {updatePayment.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
