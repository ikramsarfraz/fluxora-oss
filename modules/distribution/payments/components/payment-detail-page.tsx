"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/detail-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { usePayment, useVoidPayment } from "../hooks/use-payments";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { can } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/utils/date";
import type { PaymentDetail } from "../services/payments";
import { PaymentEditDialog } from "./payment-edit-dialog";

function paymentMethodLabel(
  method: PaymentDetail["paymentMethod"],
): string {
  const map: Record<PaymentDetail["paymentMethod"], string> = {
    cash: "Cash",
    check: "Check",
    ach: "ACH",
    zelle: "Zelle",
    credit_card: "Credit card",
  };
  return map[method] ?? method;
}

export function PaymentDetailPage({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const { data: payment, isLoading, error, refetch } = usePayment(paymentId);
  const { data: currentUser } = useCurrentPortalUser();
  const voidPayment = useVoidPayment();
  const canModify = can(currentUser?.role, "record_payment");

  const [editOpen, setEditOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  useSetBreadcrumbLabel(
    `/payments/${paymentId}`,
    payment ? `Payment ${formatDisplayDate(payment.paymentDate)}` : null,
  );

  if (isLoading) {
    return <DetailPageSkeleton sections={2} />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  if (!payment) {
    return (
      <div className="text-sm text-muted-foreground" role="alert">
        Payment not found.
      </div>
    );
  }

  const invoice = payment.salesInvoice;
  const customer = invoice?.customer;

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={`Payment ${formatDisplayDate(payment.paymentDate)}`}
        description="Customer payment applied to a sales invoice."
        badge={
          <Badge variant="outline" className="font-normal">
            {paymentMethodLabel(payment.paymentMethod)}
          </Badge>
        }
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/payments">
              <ArrowLeft className="size-4" />
              Back to payments
            </Link>
          </Button>
          {canModify ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVoidOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Void
              </Button>
            </>
          ) : null}
        </div>
      </DetailPageHeader>

      <DetailSection title="Summary" description="Payment amount and method.">
        <DetailGrid>
          <DetailField label="Payment date">
            {formatDisplayDate(payment.paymentDate)}
          </DetailField>
          <DetailField label="Amount">
            <span className="tabular-nums">
              {formatMoney(payment.amount)}
            </span>
          </DetailField>
          <DetailField label="Method">
            {paymentMethodLabel(payment.paymentMethod)}
          </DetailField>
          <DetailField label="Reference">
            {payment.referenceNumber ?? payment.checkNumber ?? "—"}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Linked invoice"
        description="Sales invoice this payment was applied to."
      >
        {invoice ? (
          <DetailGrid>
            <DetailField label="Invoice number">
              <Link
                href={`/invoices/${invoice.id}`}
                className="hover:underline"
              >
                {invoice.invoiceNumber}
              </Link>
            </DetailField>
            <DetailField label="Invoice date">
              {formatDisplayDate(invoice.invoiceDate)}
            </DetailField>
            <DetailField label="Total amount">
              <span className="tabular-nums">
                {formatMoney(invoice.totalAmount)}
              </span>
            </DetailField>
            <DetailField label="Balance due">
              <span className="tabular-nums">
                {formatMoney(invoice.balanceDue)}
              </span>
            </DetailField>
          </DetailGrid>
        ) : (
          <p className="text-sm text-muted-foreground">
            The linked invoice is no longer available.
          </p>
        )}
      </DetailSection>

      {(() => {
        const otherPayments = (invoice?.payments ?? []).filter(
          p => p.id !== payment.id,
        );
        if (otherPayments.length === 0) return null;
        const otherTotal = otherPayments.reduce(
          (sum, p) => sum + (parseFloat(p.amount) || 0),
          0,
        );
        return (
          <DetailSection
            title="Other payments on this invoice"
            description={`${otherPayments.length} additional payment${otherPayments.length === 1 ? "" : "s"} totalling ${formatMoney(otherTotal)}.`}
          >
            <div className="overflow-hidden rounded-md border border-border-default">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-divider text-[11px] font-medium uppercase tracking-wide text-subtle">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Recorded by</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {otherPayments.map((p, i) => {
                    const ref = p.referenceNumber ?? p.checkNumber ?? null;
                    return (
                      <tr
                        key={p.id}
                        className={i % 2 === 1 ? "bg-divider/40" : ""}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href={`/payments/${p.id}`}
                            className="border-b border-dashed border-border-default text-ink-warm hover:text-ink"
                          >
                            {formatDisplayDate(p.paymentDate)}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-ink-warm">
                          {paymentMethodLabel(p.paymentMethod)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-ink-warm">
                          {ref ?? <span className="text-subtle">—</span>}
                        </td>
                        <td className="px-3 py-2 text-ink-warm">
                          {p.createdBy?.fullName ?? (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(p.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DetailSection>
        );
      })()}

      <DetailSection
        title="Customer"
        description="Customer the invoice was issued to."
      >
        {customer ? (
          <DetailGrid>
            <DetailField label="Name">
              <Link
                href={`/customers/${customer.id}`}
                className="hover:underline"
              >
                {customer.name}
              </Link>
            </DetailField>
          </DetailGrid>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </DetailSection>

      {payment.notes ? (
        <DetailSection title="Notes">
          <p className="whitespace-pre-wrap text-sm">{payment.notes}</p>
        </DetailSection>
      ) : null}

      <DetailSection title="Metadata">
        <DetailGrid>
          <DetailField label="Recorded by">
            {payment.createdBy?.fullName ?? "—"}
          </DetailField>
          <DetailField label="Recorded at">
            {formatDisplayDateTime(payment.createdAt)}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <PaymentEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        payment={payment}
      />

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice ? (
                <>
                  This permanently removes the{" "}
                  <strong className="tabular-nums">
                    {formatMoney(payment.amount)}
                  </strong>{" "}
                  payment from invoice{" "}
                  <strong className="font-mono">
                    {invoice.invoiceNumber}
                  </strong>
                  . The invoice&apos;s paid amount, balance due, and status will
                  recalculate automatically. The action is captured in the
                  audit log.
                </>
              ) : (
                <>This permanently removes the payment. The action is captured in the audit log.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={voidPayment.isPending}
              onClick={() => {
                voidPayment.mutate(payment.id, {
                  onSuccess: result => {
                    toast.success("Payment voided.");
                    router.push(`/invoices/${result.invoiceId}`);
                  },
                  onError: e => toast.error(e.message),
                });
              }}
            >
              {voidPayment.isPending ? "Voiding…" : "Void payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
