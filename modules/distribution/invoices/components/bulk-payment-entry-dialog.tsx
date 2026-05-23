"use client";

import { useEffect, useMemo, useState } from "react";
// crypto.randomUUID is a browser-native API on the renderer side here.
import { AlertCircle, Receipt } from "lucide-react";
import { toast } from "sonner";

import {
  useOpenInvoicesForCustomer,
  useRecordBulkPaymentForCustomer,
} from "../hooks/use-invoices";
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
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/modules/shared/utils/payment-methods";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

/**
 * "Apply one payment across N invoices" dialog launched from the
 * customer detail page. Shows all of the customer's open invoices in
 * an allocation grid. User enters the total payment received; the
 * "Auto-allocate (FIFO)" button fills the per-invoice amounts oldest-
 * first. Per-row amounts are editable. Sum-of-amounts must equal the
 * total before save.
 */
export function BulkPaymentEntryDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record bulk payment</DialogTitle>
          <DialogDescription>
            Apply one payment from <strong>{customerName}</strong> across
            multiple open invoices.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <Body
            customerId={customerId}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const { data: openInvoices, isLoading } = useOpenInvoicesForCustomer(customerId);
  const recordBulk = useRecordBulkPaymentForCustomer();
  const { data: currentUser } = useCurrentPortalUser();
  const canRecord = can(currentUser?.role, "record_payment");
  const recordDeniedReason = canRecord
    ? null
    : getPermissionDeniedReason("record_payment");

  // One key per dialog mount — survives retries (network blip, react-query
  // re-fire) so the server can dedupe against the (tenant_id,
  // idempotency_key) partial unique index on the anchor row.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [totalAmount, setTotalAmount] = useState<string>("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [paymentDate, setPaymentDate] = useState<string>(todayString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ach");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [checkNumber, setCheckNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset allocation state whenever the invoice set comes in or changes
  // (e.g. another tab recorded a payment and we re-fetch).
  useEffect(() => {
    if (openInvoices) {
      setAllocations(
        Object.fromEntries(openInvoices.map(inv => [inv.id, ""])),
      );
    }
  }, [openInvoices]);

  const numericTotal = Number(totalAmount) || 0;
  const numericAllocSum = useMemo(
    () =>
      Object.values(allocations).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0,
      ),
    [allocations],
  );
  const remaining = numericTotal - numericAllocSum;

  function autoAllocateFifo() {
    if (!openInvoices || numericTotal <= 0) return;
    let left = numericTotal;
    const next: Record<string, string> = {};
    for (const inv of openInvoices) {
      const balance = Number(inv.balanceDue) || 0;
      if (left <= 0 || balance <= 0) {
        next[inv.id] = "";
        continue;
      }
      const applied = Math.min(left, balance);
      next[inv.id] = applied.toFixed(2);
      left -= applied;
    }
    setAllocations(next);
  }

  function updateAllocation(invoiceId: string, value: string) {
    setAllocations(prev => ({ ...prev, [invoiceId]: value }));
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (!openInvoices || openInvoices.length === 0) {
      setSubmitError("This customer has no open invoices.");
      return;
    }

    if (numericTotal <= 0) {
      setSubmitError("Enter the total amount of the payment received.");
      return;
    }

    if (Math.abs(numericAllocSum - numericTotal) > 0.01) {
      setSubmitError(
        `Allocated ${formatMoney(numericAllocSum)} doesn't match the total payment of ${formatMoney(numericTotal)}.`,
      );
      return;
    }

    // Per-row validation: any non-zero allocation must not exceed its
    // invoice's current balance.
    for (const inv of openInvoices) {
      const amount = Number(allocations[inv.id]) || 0;
      const balance = Number(inv.balanceDue) || 0;
      if (amount - balance > 0.01) {
        setSubmitError(
          `Allocation for ${inv.invoiceNumber} exceeds its balance due.`,
        );
        return;
      }
    }

    const allocs = openInvoices
      .map(inv => ({
        salesInvoiceId: inv.id,
        amount: allocations[inv.id] || "0",
      }))
      .filter(a => (Number(a.amount) || 0) > 0);

    if (allocs.length === 0) {
      setSubmitError("Allocate the payment to at least one invoice.");
      return;
    }

    try {
      const result = await recordBulk.mutateAsync({
        customerId,
        paymentDate,
        paymentMethod,
        checkNumber: checkNumber.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: allocs,
        idempotencyKey,
      });
      toast.success(
        `Recorded payment across ${result.createdPayments.length} invoice${result.createdPayments.length === 1 ? "" : "s"}.`,
      );
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not record payment.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!openInvoices || openInvoices.length === 0) {
    return (
      <Alert>
        <Receipt />
        <AlertTitle>No open invoices</AlertTitle>
        <AlertDescription>
          This customer has no invoices with a remaining balance to apply a
          payment to.
        </AlertDescription>
      </Alert>
    );
  }

  const totalBalanceDue = openInvoices.reduce(
    (sum, inv) => sum + (Number(inv.balanceDue) || 0),
    0,
  );

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

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bulk-payment-total">Total amount received</FieldLabel>
            <Input
              id="bulk-payment-total"
              inputMode="decimal"
              placeholder={`Up to ${formatMoney(totalBalanceDue)}`}
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
            />
            <FieldDescription>
              {totalBalanceDue > 0
                ? `${formatMoney(totalBalanceDue)} in total open balance.`
                : "No open balance."}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="bulk-payment-date">Payment date</FieldLabel>
            <Input
              id="bulk-payment-date"
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="-mx-6 max-h-[280px] overflow-y-auto border-y border-border-default">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="bg-divider text-[11px] font-medium uppercase tracking-wide text-subtle">
                <th className="px-6 py-2 text-left">Invoice</th>
                <th className="px-3 py-2 text-left">Due</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-6 py-2 text-right">Apply</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.map((inv, i) => {
                const balance = Number(inv.balanceDue) || 0;
                const applied = Number(allocations[inv.id]) || 0;
                const overApplied = applied - balance > 0.01;
                return (
                  <tr
                    key={inv.id}
                    className={i % 2 === 1 ? "bg-divider/40" : ""}
                  >
                    <td className="px-6 py-2 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-warm">
                      {inv.dueDate ? formatDisplayDate(inv.dueDate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                      {formatMoney(balance)}
                    </td>
                    <td className="px-6 py-2 text-right">
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={allocations[inv.id] ?? ""}
                        onChange={e => updateAllocation(inv.id, e.target.value)}
                        aria-invalid={overApplied}
                        className={`h-8 w-24 text-right font-mono text-xs ${overApplied ? "border-destructive" : ""}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-subtle">
            Allocated{" "}
            <span className="font-mono font-medium text-ink tabular-nums">
              {formatMoney(numericAllocSum)}
            </span>{" "}
            of{" "}
            <span className="font-mono font-medium text-ink tabular-nums">
              {formatMoney(numericTotal)}
            </span>
            {Math.abs(remaining) > 0.005 ? (
              <>
                {" · "}
                <span
                  className={
                    remaining > 0 ? "text-warning-fg" : "text-destructive"
                  }
                >
                  {remaining > 0 ? "Unallocated " : "Over-allocated "}
                  {formatMoney(Math.abs(remaining))}
                </span>
              </>
            ) : numericTotal > 0 ? (
              <span className="text-success-fg"> · Fully allocated</span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={autoAllocateFifo}
            disabled={numericTotal <= 0}
          >
            Auto-allocate (FIFO)
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bulk-payment-method">Payment method</FieldLabel>
            <Select
              value={paymentMethod}
              onValueChange={v => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger id="bulk-payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="bulk-payment-reference">Reference number</FieldLabel>
            <Input
              id="bulk-payment-reference"
              placeholder="Optional reference"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
            />
            <FieldError errors={[]} />
          </Field>
        </div>

        {paymentMethod === "check" ? (
          <Field>
            <FieldLabel htmlFor="bulk-payment-check-number">Check number</FieldLabel>
            <Input
              id="bulk-payment-check-number"
              placeholder="Check #"
              value={checkNumber}
              onChange={e => setCheckNumber(e.target.value)}
            />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="bulk-payment-notes">Notes</FieldLabel>
          <Textarea
            id="bulk-payment-notes"
            rows={2}
            placeholder="Optional notes — visible on each generated payment row"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={recordBulk.isPending || !canRecord}
            title={recordDeniedReason ?? undefined}
          >
            <Receipt className="h-4 w-4" />
            {recordBulk.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}
