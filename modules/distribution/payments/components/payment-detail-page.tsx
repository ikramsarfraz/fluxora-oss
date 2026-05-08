"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/detail-section";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { usePayment } from "../hooks/use-payments";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { PaymentDetail } from "../services/payments";

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

function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PaymentDetailPage({ paymentId }: { paymentId: string }) {
  const { data: payment, isLoading, error, refetch } = usePayment(paymentId);

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
        <Button variant="outline" asChild>
          <Link href="/payments">
            <ArrowLeft className="size-4" />
            Back to payments
          </Link>
        </Button>
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
            {formatDateTime(payment.createdAt)}
          </DetailField>
        </DetailGrid>
      </DetailSection>
    </div>
  );
}
