"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, ArrowLeft, Receipt, Search } from "lucide-react";
import { toast } from "sonner";

import { useOpenInvoicesForPayment } from "@/modules/distribution/invoices/hooks/use-invoices";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { OpenInvoiceForPayment } from "@/modules/distribution/invoices/services/invoicing";
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/modules/shared/utils/payment-methods";

type Step = "pick" | "enter";

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
}

/**
 * "Record payment" dialog launched from /payments. Two-step flow: pick
 * an open invoice (with search across invoice # and customer name),
 * then enter the payment details. The amount field is prefilled with
 * the picked invoice's balance due so the common case (paying in full)
 * is a single confirm.
 */
export function GlobalPaymentEntryDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [selectedInvoice, setSelectedInvoice] = useState<
    OpenInvoiceForPayment | null
  >(null);

  useEffect(() => {
    if (!open) {
      // Reset when closing — re-opening starts fresh.
      setStep("pick");
      setSelectedInvoice(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? "Pick the invoice this payment is being applied to."
              : selectedInvoice
                ? `Applying to ${selectedInvoice.invoiceNumber} · ${selectedInvoice.customerName}.`
                : "Enter the payment details."}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <PickInvoiceStep
            onSelect={invoice => {
              setSelectedInvoice(invoice);
              setStep("enter");
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : selectedInvoice ? (
          <EnterPaymentStep
            invoice={selectedInvoice}
            onBack={() => setStep("pick")}
            onComplete={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Step 1 — invoice picker ─────────────────────────────────────────────────

function PickInvoiceStep({
  onSelect,
  onCancel,
}: {
  onSelect: (invoice: OpenInvoiceForPayment) => void;
  onCancel: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useOpenInvoicesForPayment(debouncedSearch);

  const today = useMemo(() => new Date(), []);
  function isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < today;
  }

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          autoFocus
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search invoice # or customer name…"
          className="pl-9"
        />
      </div>

      <div className="-mx-6 max-h-[360px] overflow-y-auto border-y border-border-default">
        {isLoading && !data ? (
          <div className="space-y-2 px-6 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-subtle">
            {debouncedSearch
              ? `No open invoices match "${debouncedSearch}".`
              : "No open invoices with a balance due."}
          </div>
        ) : (
          <ul className="divide-y divide-border-default">
            {data.map(invoice => {
              const overdue = isOverdue(invoice.dueDate);
              return (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(invoice)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-3 text-left transition-colors hover:bg-divider/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-ink">
                          {invoice.invoiceNumber}
                        </span>
                        {overdue ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-subtle">
                        {invoice.customerName} ·{" "}
                        {invoice.dueDate
                          ? `Due ${formatDisplayDate(invoice.dueDate)}`
                          : "No due date"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-medium tabular-nums text-ink">
                        {formatMoney(invoice.balanceDue)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-subtle">
                        Balance due
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </DialogFooter>
    </>
  );
}

// ── Step 2 — payment entry ──────────────────────────────────────────────────

function EnterPaymentStep({
  invoice,
  onBack,
  onComplete,
}: {
  invoice: OpenInvoiceForPayment;
  onBack: () => void;
  onComplete: () => void;
}) {
  const recordPayment = useRecordPaymentForSalesOrderInvoice();
  const { data: currentUser } = useCurrentPortalUser();
  // One key per dialog mount. Persists across submit retries / network
  // hiccups so a request that succeeded server-side but failed to
  // deliver its response is recognized as the same event on retry.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const canRecord = can(currentUser?.role, "record_payment");
  const recordDeniedReason = canRecord
    ? null
    : getPermissionDeniedReason("record_payment");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const balanceDue = parseFloat(invoice.balanceDue) || 0;

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
      onComplete();
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

      <form
        className="flex flex-col gap-4"
        onSubmit={event => void handleSubmit(onSubmit)(event)}
      >
        <FieldDescription>
          {invoice.customerName} · Dated{" "}
          {invoice.invoiceDate
            ? formatDisplayDate(invoice.invoiceDate)
            : "—"}{" "}
          · Balance due {formatMoney(balanceDue)}
        </FieldDescription>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="global-payment-date">Payment date</FieldLabel>
            <Input
              id="global-payment-date"
              type="date"
              {...register("paymentDate", {
                required: "Enter a payment date.",
              })}
            />
            <FieldError errors={[errors.paymentDate]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="global-payment-amount">Amount</FieldLabel>
            <Input
              id="global-payment-amount"
              inputMode="decimal"
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
            <FieldLabel htmlFor="global-payment-method">Payment method</FieldLabel>
            <Controller
              control={control}
              name="paymentMethod"
              rules={{ required: "Select a payment method." }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="global-payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.paymentMethod]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="global-payment-reference">Reference number</FieldLabel>
            <Input
              id="global-payment-reference"
              placeholder="Optional reference"
              {...register("referenceNumber")}
            />
          </Field>
        </div>

        {paymentMethod === "check" ? (
          <Field>
            <FieldLabel htmlFor="global-payment-check-number">Check number</FieldLabel>
            <Input
              id="global-payment-check-number"
              placeholder="Check number"
              {...register("checkNumber")}
            />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="global-payment-notes">Notes</FieldLabel>
          <Textarea
            id="global-payment-notes"
            rows={3}
            placeholder="Optional notes…"
            {...register("notes")}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Pick a different invoice
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
    </>
  );
}
