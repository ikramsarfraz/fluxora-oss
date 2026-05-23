"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, ArrowLeft, Receipt, Search } from "lucide-react";
import { toast } from "sonner";

import { useOpenBillsForPayment } from "../hooks/use-bill-payments";
import { useRecordSupplierInvoicePayment } from "@/modules/distribution/supplier-invoices/hooks/use-supplier-invoices";
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
import type {
  BillPaymentMethod,
  OpenBillForPayment,
} from "../services/supplier-payments";

type Step = "pick" | "enter";

const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  value: BillPaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH" },
  { value: "zelle", label: "Zelle" },
  { value: "credit_card", label: "Credit card" },
];

interface PaymentFormValues {
  paymentDate: string;
  amount: string;
  paymentMethod: BillPaymentMethod;
  checkNumber: string;
  referenceNumber: string;
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
 * Two-step "Record bill payment" dialog launched from /bill-payments.
 * Step 1: pick a completed bill with a remaining balance (search across
 * bill # and supplier name). Step 2: enter the payment details prefilled
 * with the bill's balance due.
 */
export function GlobalBillPaymentEntryDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [selectedBill, setSelectedBill] = useState<OpenBillForPayment | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setStep("pick");
      setSelectedBill(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record bill payment</DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? "Pick the supplier bill this payment is being applied to."
              : selectedBill
                ? `Applying to ${selectedBill.invoiceNumber} · ${selectedBill.supplierName}.`
                : "Enter the payment details."}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <PickBillStep
            onSelect={bill => {
              setSelectedBill(bill);
              setStep("enter");
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : selectedBill ? (
          <EnterPaymentStep
            bill={selectedBill}
            onBack={() => setStep("pick")}
            onComplete={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Step 1 — bill picker ────────────────────────────────────────────────────

function PickBillStep({
  onSelect,
  onCancel,
}: {
  onSelect: (bill: OpenBillForPayment) => void;
  onCancel: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useOpenBillsForPayment(debouncedSearch);

  function isOverdue(computedDueDate: string | null): boolean {
    if (!computedDueDate) return false;
    return new Date(computedDueDate) < new Date();
  }

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          autoFocus
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search bill # or supplier name…"
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
              ? `No open bills match "${debouncedSearch}".`
              : "No open bills with a balance due."}
          </div>
        ) : (
          <ul className="divide-y divide-border-default">
            {data.map(bill => {
              const overdue = isOverdue(bill.computedDueDate);
              return (
                <li key={bill.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(bill)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-3 text-left transition-colors hover:bg-divider/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-ink">
                          {bill.invoiceNumber}
                        </span>
                        {overdue ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-subtle">
                        {bill.supplierName} ·{" "}
                        {bill.computedDueDate
                          ? `Due ${formatDisplayDate(bill.computedDueDate)}`
                          : "No net terms"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-medium tabular-nums text-ink">
                        {formatMoney(bill.balanceDue)}
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
  bill,
  onBack,
  onComplete,
}: {
  bill: OpenBillForPayment;
  onBack: () => void;
  onComplete: () => void;
}) {
  const recordPayment = useRecordSupplierInvoicePayment();
  const { data: currentUser } = useCurrentPortalUser();
  const canRecord = can(currentUser?.role, "record_supplier_payment");
  // One key per dialog mount — survives submit retries so a request
  // that succeeded server-side but lost its response is recognized.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const recordDeniedReason = canRecord
    ? null
    : getPermissionDeniedReason("record_supplier_payment");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const balanceDue = parseFloat(bill.balanceDue) || 0;

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
      checkNumber: "",
      referenceNumber: "",
      notes: "",
    },
  });

  const paymentMethod = useWatch({ control, name: "paymentMethod" });

  async function onSubmit(values: PaymentFormValues) {
    try {
      setSubmitError(null);
      await recordPayment.mutateAsync({
        supplierInvoiceId: bill.id,
        paymentDate: values.paymentDate,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        checkNumber: values.checkNumber.trim() || undefined,
        referenceNumber: values.referenceNumber.trim() || undefined,
        notes: values.notes.trim() || undefined,
        idempotencyKey,
      });
      toast.success("Bill payment recorded.");
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
          {bill.supplierName} · Dated{" "}
          {bill.invoiceDate ? formatDisplayDate(bill.invoiceDate) : "—"} ·
          Balance due {formatMoney(balanceDue)}
        </FieldDescription>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="global-bill-payment-date">Payment date</FieldLabel>
            <Input
              id="global-bill-payment-date"
              type="date"
              {...register("paymentDate", {
                required: "Enter a payment date.",
              })}
            />
            <FieldError errors={[errors.paymentDate]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="global-bill-payment-amount">Amount</FieldLabel>
            <Input
              id="global-bill-payment-amount"
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
            <FieldLabel htmlFor="global-bill-payment-method">Payment method</FieldLabel>
            <Controller
              control={control}
              name="paymentMethod"
              rules={{ required: "Select a payment method." }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="global-bill-payment-method">
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
            <FieldLabel htmlFor="global-bill-payment-reference">
              Reference number
            </FieldLabel>
            <Input
              id="global-bill-payment-reference"
              placeholder="Bank ref / transaction ID"
              {...register("referenceNumber")}
            />
          </Field>
        </div>

        {paymentMethod === "check" ? (
          <Field>
            <FieldLabel htmlFor="global-bill-payment-check-number">
              Check number
            </FieldLabel>
            <Input
              id="global-bill-payment-check-number"
              placeholder="Check #"
              {...register("checkNumber")}
            />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="global-bill-payment-notes">Notes</FieldLabel>
          <Textarea
            id="global-bill-payment-notes"
            rows={3}
            placeholder="Optional notes…"
            {...register("notes")}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Pick a different bill
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
