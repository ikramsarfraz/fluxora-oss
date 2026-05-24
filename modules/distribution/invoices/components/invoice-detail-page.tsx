"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Download, Receipt, Send } from "lucide-react";

import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { useSalesInvoice, useSalesInvoicePayments } from "../hooks/use-invoices";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { can } from "@/lib/auth/permissions";
import { InvoicePaymentEntryDialog } from "./invoice-payment-entry-dialog";
import { SendInvoiceModal } from "./send-invoice-modal";
import { formatMoney, formatWeightLbs } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatPhone } from "@/lib/utils/phone";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  good: "var(--color-success-fg)",
  goodSoft: "var(--color-success-bg)",
  warn: "var(--color-warning-fg)",
  warnSoft: "var(--color-warning-bg)",
  info: "var(--color-info-fg)",
  infoSoft: "var(--color-info-bg)",
  bad: "var(--color-danger-fg)",
  badSoft: "var(--color-danger-bg)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

export type TenantBranding = {
  companyLegalName: string | null;
  displayName: string | null;
  invoiceFooterText: string | null;
  invoiceNotesDefault: string | null;
};

type PillConfig = { label: string; bg: string; color: string };

// ── Helpers ────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  zelle: "Zelle",
  credit_card: "Credit card",
};

function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

function getStatusPill(
  status: string,
  balanceDue: number,
  dueDate: string | null | undefined,
): PillConfig {
  if (status === "void") return { label: "Voided", bg: C.line2, color: C.muted };
  if (status === "paid") return { label: "Paid in full", bg: C.goodSoft, color: C.good };
  if (status === "partially_paid") return { label: "Partially paid", bg: C.infoSoft, color: C.info };
  if (status === "sent") {
    if (balanceDue > 0 && dueDate && new Date(dueDate) < new Date()) {
      return { label: "Overdue", bg: C.badSoft, color: C.bad };
    }
    return { label: "Open", bg: C.warnSoft, color: C.warn };
  }
  return { label: "Draft", bg: C.line2, color: C.muted };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, borderRadius: C.radius, border: `1px solid ${C.line}`, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: C.muted, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TotalsRow({ label, value, bold, dimValue, accent }: {
  label: string; value: string; bold?: boolean; dimValue?: boolean; accent?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", fontSize: 13 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontFamily: C.mono, fontWeight: bold ? 600 : 400, color: accent ? C.bad : dimValue ? C.muted : C.ink }}>
        {value}
      </span>
    </div>
  );
}

function ProfitRow({ label, value, bold, positive }: {
  label: string; value: string; bold?: boolean; positive?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontFamily: C.mono, fontWeight: bold ? 600 : 400, color: positive ? C.good : C.ink2 }}>
        {value}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  invoiceId: string;
  tenantBranding: TenantBranding;
};

export function InvoiceDetailPage({ invoiceId, tenantBranding }: Props) {
  const { data: invoice, isLoading, error } = useSalesInvoice(invoiceId);
  const { data: currentUser } = useCurrentPortalUser();

  const [profitExpanded, setProfitExpanded] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const allPaymentsQuery = useSalesInvoicePayments(invoiceId, {
    enabled: showAllPayments,
  });

  useSetBreadcrumbLabel(`/invoices/${invoiceId}`, invoice?.invoiceNumber);

  useEffect(() => {
    setProfitExpanded(localStorage.getItem("invoice-profit-expanded") === "true");
  }, []);

  if (isLoading) return <DetailPageSkeleton />;
  if (error || !invoice) return <PageError message={(error as Error)?.message ?? "Invoice not found."} />;

  const canViewProfitability = can(currentUser?.role, "generate_invoice");

  const balanceDue = Number(invoice.balanceDue ?? 0);
  const amountPaid = Number(invoice.amountPaid ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const fuelSurcharge = Number(invoice.fuelSurchargeAmount ?? 0);
  const totalAmount = Number(invoice.totalAmount ?? 0);
  const discountAmount = Number(invoice.discountAmount ?? 0);
  const creditAmount = Number(invoice.creditAmount ?? 0);

  const totalCogs = (invoice.lines ?? []).reduce(
    (sum, l) => sum + (Number(l.cogsAmountSnapshot ?? 0) || 0),
    0,
  );
  const grossProfit = totalAmount - totalCogs;
  const marginPct = totalAmount > 0 ? (grossProfit / totalAmount) * 100 : 0;

  const pill = getStatusPill(invoice.status, balanceDue, invoice.dueDate);
  const brandName = tenantBranding.companyLegalName ?? tenantBranding.displayName ?? "";

  const billingAddress =
    invoice.customer?.addresses?.find(a => a.addressType === "billing") ??
    invoice.customer?.addresses?.[0];
  const shippingAddress =
    invoice.salesOrder?.customer?.addresses?.find(a => a.addressType === "shipping") ??
    invoice.salesOrder?.customer?.addresses?.[0] ??
    billingAddress;

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;
  const balancePaid = balanceDue <= 0;
  const canRecordPayment = can(currentUser?.role, "record_payment");
  const showRecordPaymentCta =
    !balancePaid && invoice.status !== "void" && canRecordPayment;
  // "Send" is shown for any non-void invoice. Same audience as
  // generate_invoice (owner/admin/accounting) — the AR send is a
  // follow-on action to invoice generation.
  const canSendInvoice = can(currentUser?.role, "generate_invoice");
  const showSendInvoiceCta = invoice.status !== "void" && canSendInvoice;
  // Send becomes the primary CTA when the invoice is still draft
  // (haven't billed the customer yet); for sent/partially_paid it sits
  // as a secondary action next to Download.
  const sendIsPrimary = invoice.status === "draft";

  function toggleProfit() {
    const next = !profitExpanded;
    setProfitExpanded(next);
    localStorage.setItem("invoice-profit-expanded", String(next));
  }

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: C.muted,
    paddingBottom: 8,
    borderBottom: `1px solid ${C.line}`,
  };

  return (
    <div style={{ padding: "0 0 64px" }}>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <h1 style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink, lineHeight: 1, margin: 0 }}>
            {invoice.invoiceNumber}
          </h1>
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
            padding: "3px 10px", borderRadius: 100, background: pill.bg, color: pill.color, lineHeight: 1.4,
          }}>
            {pill.label}
          </span>
          {invoice.customer ? (
            <Link href={`/customers/${invoice.customer.id}`} style={{ fontSize: 15, color: C.ink2, fontWeight: 500, textDecoration: "none" }}>
              {invoice.customer.name}
            </Link>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: C.muted, flexWrap: "wrap", marginBottom: 16 }}>
          {invoice.invoiceDate ? <span>Issued {formatDisplayDate(invoice.invoiceDate)}</span> : null}
          {invoice.dueDate ? <span>Due {formatDisplayDate(invoice.dueDate)}</span> : null}
          {invoice.salesOrder ? (
            <Link
              href={`/orders/${invoice.salesOrder.id}`}
              style={{ color: C.muted, textDecoration: "none", borderBottom: `1px solid ${C.line}` }}
            >
              {invoice.salesOrder.orderNumber ?? "Order"}
            </Link>
          ) : null}
          <span style={{ color: C.ink2, fontWeight: 500 }}>{formatMoney(totalAmount)}</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {showRecordPaymentCta ? (
            <button
              type="button"
              onClick={() => setRecordPaymentOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", background: C.ink, color: "var(--color-page)",
                borderRadius: C.radiusSm, fontSize: 13, fontWeight: 500,
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Receipt style={{ width: 14, height: 14 }} />
              Record payment
            </button>
          ) : null}
          {showSendInvoiceCta ? (
            <button
              type="button"
              onClick={() => setSendInvoiceOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                // Primary (filled) when draft AND no other primary CTA
                // has claimed the slot. If Record Payment is showing,
                // Send drops to secondary so we never have two filled
                // buttons competing for attention.
                background: sendIsPrimary && !showRecordPaymentCta ? C.ink : C.surface,
                color: sendIsPrimary && !showRecordPaymentCta ? "var(--color-page)" : C.ink2,
                border: sendIsPrimary && !showRecordPaymentCta ? "none" : `1px solid ${C.line}`,
                borderRadius: C.radiusSm, fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Send style={{ width: 14, height: 14 }} />
              {invoice.sendCount && invoice.sendCount > 0 ? "Resend" : "Send to customer"}
            </button>
          ) : null}
          <a
            href={pdfUrl}
            download
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px",
              // Filled only when nothing else is taking the primary slot.
              // Record Payment is primary > Send is primary (draft) > Download.
              background:
                showRecordPaymentCta || (showSendInvoiceCta && sendIsPrimary)
                  ? C.surface
                  : C.ink,
              color:
                showRecordPaymentCta || (showSendInvoiceCta && sendIsPrimary)
                  ? C.ink2
                  : "var(--color-page)",
              border:
                showRecordPaymentCta || (showSendInvoiceCta && sendIsPrimary)
                  ? `1px solid ${C.line}`
                  : "none",
              borderRadius: C.radiusSm, fontSize: 13, fontWeight: 500, textDecoration: "none",
            }}
          >
            <Download style={{ width: 14, height: 14 }} />
            Download PDF
          </a>
          {invoice.salesOrder ? (
            <Link
              href={`/orders/${invoice.salesOrder.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", background: C.surface, color: C.ink2,
                borderRadius: C.radiusSm, fontSize: 13, fontWeight: 500,
                textDecoration: "none", border: `1px solid ${C.line}`,
              }}
            >
              View order
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>

        {/* ── Left: Invoice document ──────────────────────────────────── */}
        <div style={{ background: C.surface, borderRadius: C.radius, border: `1px solid ${C.line}`, padding: "40px 44px" }}>

          {/* Brand block */}
          <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>
              {brandName}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                {invoice.invoiceNumber}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Invoice</div>
            </div>
          </div>

          {/* 3-col meta */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32, paddingBottom: 28, borderBottom: `1px solid ${C.line}` }}>
            {/* Bill to */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, marginBottom: 6 }}>Bill to</div>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{invoice.customer?.name ?? "—"}</div>
              {billingAddress ? (
                <div style={{ fontSize: 12, color: C.ink2, marginTop: 2, lineHeight: 1.5 }}>
                  {billingAddress.street}
                  {(billingAddress.city || billingAddress.state || billingAddress.zip) ? (
                    <><br />{[billingAddress.city, billingAddress.state, billingAddress.zip].filter(Boolean).join(", ")}</>
                  ) : null}
                </div>
              ) : null}
              {invoice.customer?.phoneNumber ? (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{formatPhone(invoice.customer.phoneNumber)}</div>
              ) : null}
            </div>

            {/* Ship to */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, marginBottom: 6 }}>Ship to</div>
              {shippingAddress ? (
                <>
                  <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>
                    {invoice.salesOrder?.customer?.name ?? invoice.customer?.name ?? "—"}
                  </div>
                  <div style={{ fontSize: 12, color: C.ink2, marginTop: 2, lineHeight: 1.5 }}>
                    {shippingAddress.street}
                    {(shippingAddress.city || shippingAddress.state || shippingAddress.zip) ? (
                      <><br />{[shippingAddress.city, shippingAddress.state, shippingAddress.zip].filter(Boolean).join(", ")}</>
                    ) : null}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.muted }}>—</div>
              )}
            </div>

            {/* Dates */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, marginBottom: 6 }}>Dates</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Issued</span>
                  <span style={{ color: C.ink, fontFamily: C.mono }}>
                    {invoice.invoiceDate ? formatDisplayDate(invoice.invoiceDate) : "—"}
                  </span>
                </div>
                {invoice.dueDate ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: C.muted }}>Due</span>
                    <span style={{ color: C.ink, fontFamily: C.mono }}>{formatDisplayDate(invoice.dueDate)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Line items table — family-aware: when no line on the invoice
              carries a weight (i.e. a pure beverages / dry-goods order),
              the Weight column is hidden so the row doesn't show "0.00"
              for every line. Mixed invoices keep the column and show
              "—" on non-weight rows. */}
          {(() => {
            const lines = invoice.lines ?? [];
            const anyHasWeight = lines.some(
              line => Number(line.billedWeightLbs ?? 0) > 0,
            );
            return (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: 24,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Item</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
                    {anyHasWeight ? (
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        Weight
                      </th>
                    ) : null}
                    <th style={{ ...thStyle, textAlign: "right" }}>
                      Unit price
                    </th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const baseAbbr =
                      line.product?.baseUnit?.abbreviation ?? "lb";
                    const lineHasWeight =
                      Number(line.billedWeightLbs ?? 0) > 0;
                    return (
                      <tr
                        key={line.id}
                        style={{
                          background: i % 2 === 1 ? C.line2 : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 0", fontSize: 13 }}>
                          <div style={{ fontWeight: 500, color: C.ink }}>
                            {line.product?.name ?? "—"}
                          </div>
                          {line.product?.sku ? (
                            <div
                              style={{
                                fontSize: 11,
                                fontFamily: C.mono,
                                color: C.muted,
                              }}
                            >
                              {line.product.sku}
                            </div>
                          ) : null}
                        </td>
                        <td
                          style={{
                            padding: "10px 0",
                            fontSize: 13,
                            textAlign: "right",
                            color: C.ink2,
                            fontFamily: C.mono,
                          }}
                        >
                          {line.quantityCases.toLocaleString()}
                        </td>
                        {anyHasWeight ? (
                          <td
                            style={{
                              padding: "10px 0",
                              fontSize: 13,
                              textAlign: "right",
                              color: C.ink2,
                              fontFamily: C.mono,
                            }}
                          >
                            {lineHasWeight ? (
                              <>
                                {formatWeightLbs(line.billedWeightLbs)}{" "}
                                {baseAbbr}
                              </>
                            ) : (
                              <span style={{ color: C.muted }}>—</span>
                            )}
                          </td>
                        ) : null}
                        <td
                          style={{
                            padding: "10px 0",
                            fontSize: 13,
                            textAlign: "right",
                            color: C.ink2,
                            fontFamily: C.mono,
                          }}
                        >
                          {formatMoney(line.unitPrice)}
                        </td>
                        <td
                          style={{
                            padding: "10px 0",
                            fontSize: 13,
                            textAlign: "right",
                            fontFamily: C.mono,
                            fontWeight: 500,
                            color: C.ink,
                          }}
                        >
                          {formatMoney(line.lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}

          {/* Totals block */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: tenantBranding.invoiceFooterText || tenantBranding.invoiceNotesDefault ? 32 : 0 }}>
            <div style={{ width: 260 }}>
              <TotalsRow label="Subtotal" value={formatMoney(subtotal)} />
              {fuelSurcharge !== 0 ? <TotalsRow label="Fuel surcharge" value={formatMoney(fuelSurcharge)} /> : null}
              {discountAmount !== 0 ? <TotalsRow label="Discount" value={`−${formatMoney(discountAmount)}`} /> : null}
              {creditAmount !== 0 ? <TotalsRow label="Credit" value={`−${formatMoney(creditAmount)}`} /> : null}
              <div style={{ height: 1, background: C.line, margin: "6px 0" }} />
              <TotalsRow label="Grand total" value={formatMoney(totalAmount)} bold />
              {amountPaid > 0 ? <TotalsRow label="Paid" value={`−${formatMoney(amountPaid)}`} dimValue /> : null}
              <div style={{ height: 1, background: C.line, margin: "6px 0" }} />
              <TotalsRow label="Balance due" value={formatMoney(balanceDue)} bold accent={balanceDue > 0} />
            </div>
          </div>

          {/* Payment history — visible once any payment has been recorded.
              Initial render uses the most-recent 10 embedded in the invoice
              payload; clicking "View all" expands to the full list. */}
          {(invoice.payments?.length ?? 0) > 0 ? (() => {
            const embeddedPayments = invoice.payments ?? [];
            const totalCount =
              invoice.paymentCount ?? embeddedPayments.length;
            const hasMore = totalCount > embeddedPayments.length;
            // Use the full list once it's loaded; otherwise show the embedded preview.
            const displayedPayments =
              showAllPayments && allPaymentsQuery.data
                ? allPaymentsQuery.data
                : embeddedPayments;
            return (
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 20, marginBottom: tenantBranding.invoiceFooterText || tenantBranding.invoiceNotesDefault ? 28 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, marginBottom: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span>Payment history</span>
                  {totalCount > embeddedPayments.length && !showAllPayments ? (
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      Showing {embeddedPayments.length} of {totalCount}
                    </span>
                  ) : null}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Method</th>
                      <th style={thStyle}>Reference</th>
                      <th style={thStyle}>Recorded by</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPayments.map((payment, i) => {
                      const ref = payment.referenceNumber ?? payment.checkNumber ?? null;
                      return (
                        <tr key={payment.id} style={{ background: i % 2 === 1 ? C.line2 : "transparent" }}>
                          <td style={{ padding: "8px 0", fontSize: 13, fontFamily: C.mono, color: C.ink2 }}>
                            <Link
                              href={`/payments/${payment.id}`}
                              style={{ color: "inherit", textDecoration: "none", borderBottom: `1px dashed ${C.line}` }}
                            >
                              {formatDisplayDate(payment.paymentDate)}
                            </Link>
                          </td>
                          <td style={{ padding: "8px 0", fontSize: 13, color: C.ink2 }}>
                            {paymentMethodLabel(payment.paymentMethod)}
                          </td>
                          <td style={{ padding: "8px 0", fontSize: 13, color: C.ink2, fontFamily: ref ? C.mono : "inherit" }}>
                            {ref ?? <span style={{ color: C.muted }}>—</span>}
                          </td>
                          <td style={{ padding: "8px 0", fontSize: 13, color: C.ink2 }}>
                            {payment.createdBy?.fullName ?? <span style={{ color: C.muted }}>—</span>}
                          </td>
                          <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", fontFamily: C.mono, color: C.ink, fontWeight: 500 }}>
                            {formatMoney(payment.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {hasMore && !showAllPayments ? (
                  <button
                    type="button"
                    onClick={() => setShowAllPayments(true)}
                    disabled={allPaymentsQuery.isFetching}
                    style={{
                      marginTop: 12,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      fontSize: 12,
                      color: C.info,
                      cursor: allPaymentsQuery.isFetching ? "default" : "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {allPaymentsQuery.isFetching
                      ? "Loading…"
                      : `View all ${totalCount} payments`}
                  </button>
                ) : null}
              </div>
            );
          })() : null}

          {/* Footer */}
          {(tenantBranding.invoiceFooterText || tenantBranding.invoiceNotesDefault) ? (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {tenantBranding.invoiceFooterText ? (
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{tenantBranding.invoiceFooterText}</div>
              ) : null}
              {tenantBranding.invoiceNotesDefault ? (
                <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.6 }}>{tenantBranding.invoiceNotesDefault}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Right: Sticky sidebar ────────────────────────────────────── */}
        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Balance due card */}
          <div style={{
            background: balancePaid ? C.goodSoft : C.badSoft,
            borderRadius: C.radius,
            padding: "18px 20px",
            border: `1px solid ${balancePaid ? "oklch(88% 0.06 155)" : "oklch(88% 0.07 25)"}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: balancePaid ? C.good : C.bad, marginBottom: 4 }}>
              Balance due
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 700, color: balancePaid ? C.good : C.bad }}>
              {formatMoney(balanceDue)}
            </div>
          </div>

          {/* Customer card */}
          {invoice.customer ? (
            <SidebarCard title="Customer">
              <Link
                href={`/customers/${invoice.customer.id}`}
                style={{ fontSize: 14, fontWeight: 600, color: C.ink, textDecoration: "none", display: "block", marginBottom: 4 }}
              >
                {invoice.customer.name}
              </Link>
              {invoice.customer.phoneNumber ? (
                <div style={{ fontSize: 12, color: C.muted }}>{formatPhone(invoice.customer.phoneNumber)}</div>
              ) : null}
            </SidebarCard>
          ) : null}

          {/* Linked card */}
          <SidebarCard title="Linked">
            {invoice.salesOrder ? (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Order </span>
                <Link
                  href={`/orders/${invoice.salesOrder.id}`}
                  style={{ fontSize: 13, fontFamily: C.mono, color: C.ink2, textDecoration: "none", fontWeight: 500 }}
                >
                  {invoice.salesOrder.orderNumber ?? invoice.salesOrder.id.slice(0, 8)}
                </Link>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>No linked order</div>
            )}
            {invoice.createdBy ? (
              <div style={{ paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 11, color: C.muted }}>Created by </span>
                <span style={{ fontSize: 13, color: C.ink2 }}>{invoice.createdBy.fullName}</span>
              </div>
            ) : null}
          </SidebarCard>

          {/* Profitability card — staff only, collapsible */}
          {canViewProfitability ? (
            <div style={{ background: C.surface, borderRadius: C.radius, border: `1px solid ${C.line}`, overflow: "hidden" }}>
              <button
                type="button"
                onClick={toggleProfit}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "12px 16px", background: "none", border: "none",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: C.ink2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Profitability
                </span>
                {profitExpanded
                  ? <ChevronDown style={{ width: 14, height: 14, color: C.muted }} />
                  : <ChevronRight style={{ width: 14, height: 14, color: C.muted }} />}
              </button>
              {profitExpanded ? (
                <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <ProfitRow label="Revenue" value={formatMoney(totalAmount)} />
                    <ProfitRow label="COGS" value={formatMoney(totalCogs)} />
                    <div style={{ height: 1, background: C.line }} />
                    <ProfitRow label="Gross profit" value={formatMoney(grossProfit)} bold positive={grossProfit > 0} />
                    <ProfitRow label="Margin" value={`${marginPct.toFixed(1)}%`} bold positive={grossProfit > 0} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <InvoicePaymentEntryDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        invoice={{
          id: invoice.id,
          salesOrderId: invoice.salesOrderId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate ?? null,
          status: invoice.status,
          balanceDue: invoice.balanceDue ?? "0",
        }}
      />

      <SendInvoiceModal
        open={sendInvoiceOpen}
        onOpenChange={setSendInvoiceOpen}
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate ?? "",
          dueDate: invoice.dueDate ?? null,
          totalAmount: invoice.totalAmount ?? "0",
          balanceDue: invoice.balanceDue ?? "0",
          customerName: invoice.customer?.name ?? null,
          status: invoice.status,
        }}
      />
    </div>
  );
}
