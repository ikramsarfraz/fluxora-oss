"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/listing-page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import {
  useCompleteSupplierInvoice,
  useDeleteSupplierInvoice,
  useReverseSupplierInvoice,
  useSupplierInvoice,
} from "../hooks/use-supplier-invoices";
import { can, getPermissionDeniedReason } from "@/lib/auth/permissions";
import {
  formatEditableWeight,
  inferPersistedCaseWeightPattern,
  parsePersistedCaseWeights,
  summarizePersistedCaseWeights,
} from "@/modules/distribution/supplier-invoices/utils/case-weights";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { computePaymentSummary } from "@/modules/distribution/supplier-invoices/utils/payment-summary";

import { SupplierInvoiceAttachmentsCard } from "./supplier-invoice-attachments-card";
import { SupplierInvoiceActivityTimeline } from "./supplier-invoice-activity-timeline";
import { SupplierInvoicePaymentEntryDialog } from "./supplier-invoice-payment-entry-dialog";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  accent: "oklch(48% 0.16 265)",
  good: "oklch(58% 0.13 155)",
  goodSoft: "oklch(96% 0.04 155)",
  warn: "oklch(70% 0.13 70)",
  warnSoft: "oklch(97% 0.04 70)",
  info: "oklch(60% 0.15 240)",
  infoSoft: "oklch(96% 0.03 240)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  zelle: "Zelle",
  credit_card: "Credit card",
};

function unitTypeLabel(type: "catch_weight" | "fixed_case") {
  return type === "catch_weight" ? "Catch weight" : "Fixed case";
}

function renderCaseWeightSummary(caseWeightsLbs: string | null): string | null {
  return summarizePersistedCaseWeights(parsePersistedCaseWeights(caseWeightsLbs));
}

function getCaseWeightPatternLabel(caseWeightsLbs: string | null): string | null {
  const pattern = inferPersistedCaseWeightPattern(
    parsePersistedCaseWeights(caseWeightsLbs),
  );
  if (pattern === "shared_default") return "Shared default + overrides";
  if (pattern === "manual") return "Manual case weights";
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SupplierInvoiceDetailPage({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const router = useRouter();
  const { data: invoice, isLoading, error } = useSupplierInvoice(invoiceId);
  const { data: currentUser } = useCurrentPortalUser();
  const role = currentUser?.role ?? null;

  const completeMutation = useCompleteSupplierInvoice();
  const deleteMutation = useDeleteSupplierInvoice();
  const reverseMutation = useReverseSupplierInvoice();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expandedCaseWeightLines, setExpandedCaseWeightLines] = useState<Set<string>>(
    new Set(),
  );

  useSetBreadcrumbLabel(`/supplier-invoices/${invoiceId}`, invoice?.invoiceNumber);

  if (isLoading) return <DetailPageSkeleton includeTable />;
  if (error || !invoice) {
    return (
      <PageError
        message={error ? (error as Error).message : "Bill not found."}
      />
    );
  }

  // ── Permission & workflow gates ──────────────────────────────────────────

  const isDraft = invoice.status === "draft";

  const allLots = invoice.lines.flatMap(line =>
    line.lotReceipts.map(r => r.lot).filter(Boolean),
  );
  const allItems = allLots.flatMap(lot => lot?.inventoryItems ?? []);
  const totalCases = allItems.reduce((acc, i) => acc + (i.cases ?? 0), 0);
  const totalWeight = allItems.reduce(
    (acc, i) => acc + Number(i.exactWeightLbs ?? 0),
    0,
  );
  const blockedItems = allItems.filter(i => i.status !== "in_stock");

  const workflowAllowsReverse =
    invoice.status === "completed" && blockedItems.length === 0;
  const canReverseByRole = can(role, "reverse_supplier_receipt");
  const canReverse = workflowAllowsReverse && canReverseByRole;
  const reverseDisabledReason =
    invoice.status !== "completed"
      ? undefined
      : blockedItems.length > 0
        ? `Cannot reverse: ${blockedItems.length} inventory item(s) are no longer in stock.`
        : !canReverseByRole
          ? getPermissionDeniedReason("reverse_supplier_receipt")
          : undefined;

  const paymentSummary = computePaymentSummary(invoice);
  const numericBalanceDue = Number(paymentSummary.balanceDue) || 0;
  const workflowAllowsPayment =
    invoice.status === "completed" && numericBalanceDue > 0.005;
  const canRecordPaymentByRole = can(role, "record_supplier_payment");
  const canRecordPayment = workflowAllowsPayment && canRecordPaymentByRole;
  const recordPaymentDisabledReason =
    invoice.status !== "completed"
      ? "Only received bills can be paid."
      : numericBalanceDue <= 0.005
        ? "No balance remaining on this invoice."
        : !canRecordPaymentByRole
          ? getPermissionDeniedReason("record_supplier_payment")
          : undefined;

  const canEditByRole = can(role, "edit_supplier_invoice");
  const canCompleteByRole = can(role, "complete_supplier_invoice");
  const canDeleteByRole = can(role, "delete_supplier_invoice");
  const editDisabledReason = !canEditByRole
    ? getPermissionDeniedReason("edit_supplier_invoice")
    : undefined;
  const completeDisabledReason = !canCompleteByRole
    ? getPermissionDeniedReason("complete_supplier_invoice")
    : undefined;
  const deleteDisabledReason = !canDeleteByRole
    ? getPermissionDeniedReason("delete_supplier_invoice")
    : undefined;

  // ── Status pill ──────────────────────────────────────────────────────────

  const statusPill = isDraft
    ? { label: "Draft", bg: C.line2, color: C.muted }
    : { label: "Received", bg: C.goodSoft, color: C.good };

  const paymentStatusPill: Record<
    typeof paymentSummary.paymentStatus,
    { label: string; bg: string; color: string }
  > = {
    unpaid: { label: "Unpaid", bg: C.warnSoft, color: C.warn },
    partial: { label: "Partially paid", bg: C.infoSoft, color: C.info },
    paid: { label: "Paid", bg: C.goodSoft, color: C.good },
  };

  // ── Toggle case weight row ───────────────────────────────────────────────

  function toggleCaseWeightLine(lineId: string) {
    setExpandedCaseWeightLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Geist', system-ui, sans-serif", color: C.ink, lineHeight: "1.5" }}>

      {/* ── PAGE HEADER ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "24px",
          alignItems: "start",
          paddingBottom: "22px",
          borderBottom: `1px solid ${C.line}`,
          marginBottom: "24px",
        }}
      >
        {/* Left: identity */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1
              style={{
                fontFamily: C.mono,
                fontSize: "26px",
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: C.ink,
                margin: 0,
              }}
            >
              {invoice.invoiceNumber}
            </h1>
            <StatusPill
              label={statusPill.label}
              bg={statusPill.bg}
              color={statusPill.color}
            />
          </div>

          {invoice.supplier && (
            <div style={{ fontSize: "16px", color: C.ink2, marginTop: "4px" }}>
              {invoice.supplier.name}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "18px",
              marginTop: "14px",
              color: C.muted,
              fontSize: "13px",
              flexWrap: "wrap",
            }}
          >
            <span>
              <b style={{ color: C.ink2, fontWeight: 500 }}>Invoice date</b>{" "}
              {formatDisplayDate(invoice.invoiceDate)}
            </span>
            <span>
              <b style={{ color: C.ink2, fontWeight: 500 }}>Receive date</b>{" "}
              {formatDisplayDate(invoice.receiveDate)}
            </span>
            {invoice.createdBy?.fullName && (
              <span>by {invoice.createdBy.fullName}</span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          {isDraft ? (
            <>
              <SecondaryBtn
                onClick={() => router.push(`/supplier-invoices/${invoiceId}/edit`)}
                disabled={!canEditByRole}
                title={editDisabledReason}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M11 2l3 3-8 8-4 1 1-4 8-8Z" />
                </svg>
                Edit
              </SecondaryBtn>
              <PrimaryBtn
                onClick={() => setCompleteOpen(true)}
                disabled={!canCompleteByRole}
                title={completeDisabledReason}
              >
                Complete &amp; receive
              </PrimaryBtn>
            </>
          ) : (
            <>
              <SecondaryBtn
                onClick={() => setReverseOpen(true)}
                disabled={!canReverse || reverseMutation.isPending}
                title={reverseDisabledReason}
              >
                Reverse receipt
              </SecondaryBtn>
              <PrimaryBtn
                onClick={() => setPaymentOpen(true)}
                disabled={!canRecordPayment}
                title={recordPaymentDisabledReason}
              >
                Record payment
              </PrimaryBtn>
            </>
          )}

          {/* More menu */}
          {isDraft && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="size-[30px] border-stone-line bg-stone-surface text-stone-ink2 shadow-none hover:bg-stone-line2"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={canDeleteByRole ? () => setDeleteOpen(true) : undefined}
                  disabled={!canDeleteByRole}
                  title={deleteDisabledReason}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── BODY GRID ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "28px",
          alignItems: "start",
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>

          {/* Line items */}
          <Section
            title="Line items"
            description="Products on this bill. Each line produced one lot when received."
          >
            <div style={{ overflowX: "auto" }}>
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unit type</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead className="text-right">Weight lbs</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground h-20 text-center"
                      >
                        No lines on this invoice.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoice.lines.map(line => {
                      const caseWeights = parsePersistedCaseWeights(line.caseWeightsLbs);
                      const hasDetailedCaseWeights =
                        line.unitType === "catch_weight" && caseWeights.length > 0;
                      const isExpanded = expandedCaseWeightLines.has(line.id);
                      const summary = renderCaseWeightSummary(line.caseWeightsLbs);
                      const patternLabel = getCaseWeightPatternLabel(line.caseWeightsLbs);

                      return (
                        <Fragment key={line.id}>
                          <TableRow>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {hasDetailedCaseWeights ? (
                                  <Button
                                    type="button"
                                    onClick={() => toggleCaseWeightLine(line.id)}
                                    aria-label={
                                      isExpanded
                                        ? "Hide case weight breakdown"
                                        : "Show case weight breakdown"
                                    }
                                    variant="ghost"
                                    size="icon-xs"
                                    className="size-6 shrink-0 text-stone-muted hover:bg-stone-line2 hover:text-stone-ink"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="size-3.5" />
                                    ) : (
                                      <ChevronRight className="size-3.5" />
                                    )}
                                  </Button>
                                ) : null}
                                {line.product ? (
                                  <Link
                                    href={`/products/${line.product.id}`}
                                    style={{ color: C.accent, textDecoration: "none" }}
                                    className="hover:underline"
                                  >
                                    {line.product.name}
                                  </Link>
                                ) : (
                                  "-"
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {line.product?.sku ?? "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                <span>{unitTypeLabel(line.unitType)}</span>
                                {patternLabel ? (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {patternLabel}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.quantityCases}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="flex flex-col items-end">
                                <span>{Number(line.weightLbs).toFixed(2)}</span>
                                {summary ? (
                                  <span className="max-w-[14rem] text-right text-xs text-muted-foreground">
                                    {summary}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(line.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(line.lineTotal)}
                            </TableCell>
                          </TableRow>
                          {hasDetailedCaseWeights && isExpanded ? (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/20 py-3">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <Badge variant="outline" className="text-xs">
                                      {caseWeights.length} case
                                      {caseWeights.length === 1 ? "" : "s"}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {Number(line.weightLbs).toFixed(2)} lb total
                                    </span>
                                  </div>
                                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                    {caseWeights.map((weight, caseIndex) => (
                                      <div
                                        key={`${line.id}-case-${caseIndex + 1}`}
                                        className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                                      >
                                        <span className="text-muted-foreground">
                                          Case {caseIndex + 1}
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {formatEditableWeight(weight)} lb
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Section>

          {/* Receiving summary */}
          <Section
            title="Receiving summary"
            description="Lots and inventory items created when this bill was received."
          >
            {allLots.length === 0 ? (
              <div
                style={{
                  border: `1px dashed ${C.line}`,
                  borderRadius: C.radiusSm,
                  padding: "24px",
                  textAlign: "center",
                  fontSize: "13px",
                  color: C.muted,
                }}
              >
                {isDraft
                  ? "Nothing received yet. Receive this bill to create lots and inventory."
                  : "This bill did not produce any receiving records."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "12px",
                  }}
                >
                  {[
                    { label: "Lots created", value: allLots.length },
                    { label: "Inventory items", value: allItems.length },
                    { label: "Total cases", value: totalCases },
                    {
                      label: "Total weight",
                      value: `${totalWeight.toFixed(2)} lbs`,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      style={{
                        background: C.line2,
                        borderRadius: C.radiusSm,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: C.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
                        {label}
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 600, color: C.ink, fontFamily: C.mono }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead>Lot #</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead className="text-right">Cases</TableHead>
                        <TableHead className="text-right">Weight lbs</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lines.flatMap(line =>
                        line.lotReceipts.flatMap(receipt => {
                          const lot = receipt.lot;
                          if (!lot) return [];
                          return lot.inventoryItems.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Link
                                  href={`/lots/${lot.id}`}
                                  style={{
                                    fontFamily: C.mono,
                                    fontSize: "13px",
                                    color: C.accent,
                                    textDecoration: "none",
                                  }}
                                  className="hover:underline"
                                >
                                  {lot.lotNumber}
                                </Link>
                              </TableCell>
                              <TableCell>
                                {formatDisplayDate(lot.expirationDate)}
                              </TableCell>
                              <TableCell>
                                <span style={{ fontFamily: C.mono, fontSize: "12px" }}>
                                  {item.barcodeId}
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {item.cases}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {Number(item.exactWeightLbs).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {item.status.replace("_", " ")}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ));
                        }),
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Section>

          {/* Payment history */}
          {invoice.status === "completed" && invoice.payments.length > 0 && (
            <Section
              title="Payment history"
              description="Payments applied to this bill."
            >
              <div style={{ overflowX: "auto" }}>
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Recorded by</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {formatDisplayDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell>
                          {PAYMENT_METHOD_LABELS[payment.paymentMethod] ??
                            payment.paymentMethod}
                        </TableCell>
                        <TableCell>
                          {payment.reference ? (
                            <span style={{ fontFamily: C.mono, fontSize: "12px" }}>
                              {payment.reference}
                            </span>
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span style={{ fontSize: "12px", color: C.muted }}>
                            {payment.createdBy?.fullName ??
                              payment.createdBy?.email ??
                              "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Section>
          )}

          {/* Attachments */}
          <SupplierInvoiceAttachmentsCard
            supplierInvoiceId={invoiceId}
            attachments={invoice.attachments}
            canUpload={canEditByRole}
            canRemove={canEditByRole}
            uploadDisabledReason={editDisabledReason}
            removeDisabledReason={editDisabledReason}
          />

          {/* Activity */}
          <Section title="Activity" description="Who touched this bill and when.">
            <SupplierInvoiceActivityTimeline supplierInvoiceId={invoiceId} />
          </Section>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside
          style={{
            position: "sticky",
            top: "76px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Invoice details */}
          <SideCard>
            <SideLabel>Bill details</SideLabel>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr",
                gap: "8px 10px",
                fontSize: "13px",
                margin: 0,
              }}
            >
              <dt style={{ color: C.muted }}>Supplier</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {invoice.supplier ? (
                  <Link
                    href={`/suppliers/${invoice.supplier.id}`}
                    style={{ color: C.accent, textDecoration: "none" }}
                    className="hover:underline"
                  >
                    {invoice.supplier.name}
                  </Link>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </dd>

              <dt style={{ color: C.muted }}>Invoice #</dt>
              <dd style={{ margin: 0, fontFamily: C.mono, fontWeight: 500 }}>
                {invoice.invoiceNumber}
              </dd>

              <dt style={{ color: C.muted }}>Invoice date</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {formatDisplayDate(invoice.invoiceDate)}
              </dd>

              <dt style={{ color: C.muted }}>Receive date</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {formatDisplayDate(invoice.receiveDate)}
              </dd>

              <dt style={{ color: C.muted }}>Total</dt>
              <dd style={{ margin: 0, fontFamily: C.mono, fontWeight: 600 }}>
                {formatMoney(invoice.totalAmount)}
              </dd>

              <dt style={{ color: C.muted }}>Payment</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {invoice.paymentMethod
                  ? (PAYMENT_METHOD_LABELS[invoice.paymentMethod] ??
                    invoice.paymentMethod)
                  : "Not specified"}
              </dd>

              {invoice.completedAt && (
                <>
                  <dt style={{ color: C.muted }}>Completed</dt>
                  <dd style={{ margin: 0, fontWeight: 500 }}>
                    {new Date(invoice.completedAt).toLocaleDateString()}
                  </dd>
                </>
              )}
            </dl>
          </SideCard>

          {/* Notes */}
          {invoice.notes && (
            <SideCard>
              <SideLabel>Notes</SideLabel>
              <p style={{ fontSize: "13px", color: C.ink2, margin: 0, whiteSpace: "pre-wrap" }}>
                {invoice.notes}
              </p>
            </SideCard>
          )}

          {/* Payment summary */}
          {invoice.status === "completed" && (
            <SideCard>
              <SideLabel>Payments</SideLabel>
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr",
                  gap: "8px 10px",
                  fontSize: "13px",
                  margin: 0,
                }}
              >
                <dt style={{ color: C.muted }}>Total</dt>
                <dd style={{ margin: 0, fontFamily: C.mono, fontWeight: 500 }}>
                  {formatMoney(paymentSummary.totalAmount)}
                </dd>

                <dt style={{ color: C.muted }}>Paid</dt>
                <dd style={{ margin: 0, fontFamily: C.mono, fontWeight: 500 }}>
                  {formatMoney(paymentSummary.totalPaid)}
                </dd>

                <dt style={{ color: C.muted }}>Balance</dt>
                <dd style={{ margin: 0, fontFamily: C.mono, fontWeight: 600 }}>
                  {formatMoney(paymentSummary.balanceDue)}
                </dd>
              </dl>
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${C.line2}` }}>
                {(() => {
                  const pill = paymentStatusPill[paymentSummary.paymentStatus];
                  return (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "100px",
                        fontSize: "12px",
                        fontWeight: 500,
                        background: pill.bg,
                        color: pill.color,
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "currentColor",
                          flexShrink: 0,
                        }}
                      />
                      {pill.label}
                    </span>
                  );
                })()}
              </div>
            </SideCard>
          )}
        </aside>
      </div>

      {/* ── DIALOGS ── */}

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Receive this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              Receiving <strong>{invoice.invoiceNumber}</strong> will
              automatically create one lot and one inventory item per line. Lot
              numbers and expirations will use any overrides you entered,
              otherwise they default to{" "}
              <code>LOT-{invoice.invoiceNumber}-XX</code> and receive date + 7
              days. Received bills can no longer be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={completeMutation.isPending || !canCompleteByRole}
              onClick={event => {
                event.preventDefault();
                completeMutation.mutate(
                  { id: invoiceId },
                  {
                    onSuccess: () => {
                      toast.success(`Bill "${invoice.invoiceNumber}" received. Lots and inventory created.`);
                      setCompleteOpen(false);
                    },
                    onError: err =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Could not receive bill.",
                      ),
                  },
                );
              }}
            >
              {completeMutation.isPending ? "Receiving…" : "Receive bill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete draft{" "}
              <strong>{invoice.invoiceNumber}</strong>. No inventory has been
              created yet, so nothing in stock changes. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending || !canDeleteByRole}
              onClick={event => {
                event.preventDefault();
                deleteMutation.mutate(invoiceId, {
                  onSuccess: () => {
                    toast.success(`Draft bill "${invoice.invoiceNumber}" deleted.`);
                    router.push("/supplier-invoices");
                  },
                  onError: err =>
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Could not delete invoice.",
                    ),
                });
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will un-receive <strong>{invoice.invoiceNumber}</strong>,
              permanently delete the {allLots.length} lot(s) and{" "}
              {allItems.length} inventory item(s) it created, and return the
              invoice to draft so it can be edited or deleted. This cannot be
              undone and is only allowed while every created item is still in
              stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverseMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={reverseMutation.isPending || !canReverse}
              onClick={event => {
                event.preventDefault();
                reverseMutation.mutate(
                  { id: invoiceId },
                  {
                    onSuccess: () => {
                      toast.success(
                        `Receipt "${invoice.invoiceNumber}" reversed.`,
                      );
                      setReverseOpen(false);
                    },
                    onError: err =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Could not reverse receipt.",
                      ),
                  },
                );
              }}
            >
              {reverseMutation.isPending ? "Reversing…" : "Reverse receipt"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SupplierInvoicePaymentEntryDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        supplierInvoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        balanceDue={paymentSummary.balanceDue}
        defaultPaymentMethod={invoice.paymentMethod ?? undefined}
      />
    </div>
  );
}

// ── Layout primitives ──────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-[10px] border-stone-line bg-stone-surface py-0 shadow-none ring-0">
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: C.ink }}>
          {title}
        </div>
        {description && (
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </Card>
  );
}

function SideCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-[10px] border-stone-line bg-stone-surface px-[18px] py-4 shadow-none ring-0">
      {children}
    </Card>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: C.muted,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: "12px",
      }}
    >
      {children}
    </div>
  );
}

// ── Button primitives ──────────────────────────────────────────────────────

function PrimaryBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 border-stone-ink bg-stone-ink px-3.5 text-[13px] text-stone-surface hover:bg-stone-ink/90 disabled:opacity-50"
    >
      {children}
    </Button>
  );
}

function SecondaryBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      variant="outline"
      className="h-8 border-stone-line bg-stone-surface px-3.5 text-[13px] text-stone-ink shadow-none hover:bg-stone-line2 disabled:opacity-50"
    >
      {children}
    </Button>
  );
}
