"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  FileText,
  Package,
  Pencil,
  Receipt,
  Trash2,
  Undo2,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/detail-section";
import { PageError } from "@/components/page-error";
import { PageLoading } from "@/components/page-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import {
  useCompleteSupplierInvoice,
  useDeleteSupplierInvoice,
  useReverseSupplierInvoice,
  useSupplierInvoice,
} from "@/hooks/use-supplier-invoices";
import { can, getPermissionDeniedReason } from "@/lib/auth/permissions";
import {
  formatEditableWeight,
  inferPersistedCaseWeightPattern,
  parsePersistedCaseWeights,
  summarizePersistedCaseWeights,
} from "@/lib/supplier-invoices/case-weights";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { computePaymentSummary } from "@/lib/supplier-invoices/payment-summary";

import { SupplierInvoiceAttachmentsCard } from "./supplier-invoice-attachments-card";
import { SupplierInvoiceActivityTimeline } from "./supplier-invoice-activity-timeline";
import { SupplierInvoicePaymentEntryDialog } from "./supplier-invoice-payment-entry-dialog";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  zelle: "Zelle",
  credit_card: "Credit card",
};

function renderCaseWeightSummary(caseWeightsLbs: string | null): string | null {
  return summarizePersistedCaseWeights(
    parsePersistedCaseWeights(caseWeightsLbs),
  );
}

function getCaseWeightPatternLabel(caseWeightsLbs: string | null): string | null {
  const pattern = inferPersistedCaseWeightPattern(
    parsePersistedCaseWeights(caseWeightsLbs),
  );
  if (pattern === "shared_default") return "Shared default + overrides";
  if (pattern === "manual") return "Manual case weights";
  return null;
}

function unitTypeLabel(type: "catch_weight" | "fixed_case") {
  return type === "catch_weight" ? "Catch weight" : "Fixed case";
}

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
  const [expandedCaseWeightLines, setExpandedCaseWeightLines] = useState<
    Set<string>
  >(new Set());

  useSetBreadcrumbLabel(
    `/supplier-invoices/${invoiceId}`,
    invoice?.invoiceNumber,
  );

  if (isLoading) return <PageLoading message="Loading supplier invoice..." />;
  if (error || !invoice) {
    return (
      <PageError
        message={
          error ? (error as Error).message : "Supplier invoice not found."
        }
      />
    );
  }

  const isDraft = invoice.status === "draft";
  const statusBadge = isDraft ? (
    <Badge variant="secondary">Draft</Badge>
  ) : (
    <Badge variant="default">Completed</Badge>
  );

  // Aggregate receiving summary across all lines.
  const allLots = invoice.lines.flatMap(line =>
    line.lotReceipts.map(r => r.lot).filter(Boolean),
  );
  const allItems = allLots.flatMap(lot => lot?.inventoryItems ?? []);
  const totalCases = allItems.reduce((acc, i) => acc + (i.cases ?? 0), 0);
  const totalWeight = allItems.reduce(
    (acc, i) => acc + Number(i.exactWeightLbs ?? 0),
    0,
  );

  // Reversal is blocked if any inventory item has been touched downstream
  // (allocated, picked, packed, shipped, sold, damaged, expired).
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
      ? "Only completed invoices can be paid."
      : numericBalanceDue <= 0.005
        ? "No balance remaining on this invoice."
        : !canRecordPaymentByRole
          ? getPermissionDeniedReason("record_supplier_payment")
          : undefined;

  // Draft-only actions: edit, complete, delete.
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
  const paymentStatusVariant: Record<
    typeof paymentSummary.paymentStatus,
    "secondary" | "outline" | "default"
  > = {
    unpaid: "outline",
    partial: "secondary",
    paid: "default",
  };
  const paymentStatusLabel: Record<typeof paymentSummary.paymentStatus, string> =
    {
      unpaid: "Unpaid",
      partial: "Partially paid",
      paid: "Paid",
    };

  function toggleCaseWeightLine(lineId: string) {
    setExpandedCaseWeightLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={invoice.invoiceNumber}
        description={
          invoice.supplier
            ? `Supplier invoice from ${invoice.supplier.name}.`
            : "Supplier invoice."
        }
        badge={statusBadge}
      >
        {isDraft ? (
          <>
            {canEditByRole ? (
              <Button asChild variant="outline">
                <Link href={`/supplier-invoices/${invoiceId}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled title={editDisabledReason}>
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
            <Button
              onClick={() => setCompleteOpen(true)}
              disabled={!canCompleteByRole}
              title={completeDisabledReason}
            >
              <CheckCircle2 className="size-4" />
              Complete & receive
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => setReverseOpen(true)}
              disabled={!canReverse || reverseMutation.isPending}
              title={reverseDisabledReason}
            >
              <Undo2 className="size-4" />
              Reverse receipt
            </Button>
            <Button
              onClick={() => setPaymentOpen(true)}
              disabled={!canRecordPayment}
              title={recordPaymentDisabledReason}
            >
              <Receipt className="size-4" />
              Record payment
            </Button>
          </>
        )}
      </DetailPageHeader>

      <DetailSection
        title="Header"
        description="Invoice metadata and receiving window."
      >
        <DetailGrid>
          <DetailField label="Supplier">
            {invoice.supplier ? (
              <Link
                href={`/suppliers/${invoice.supplier.id}`}
                className="hover:underline"
              >
                {invoice.supplier.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </DetailField>
          <DetailField label="Invoice number">
            <span className="font-mono text-sm">{invoice.invoiceNumber}</span>
          </DetailField>
          <DetailField label="Invoice date">
            {formatDisplayDate(invoice.invoiceDate)}
          </DetailField>
          <DetailField label="Receive date">
            {formatDisplayDate(invoice.receiveDate)}
          </DetailField>
          <DetailField label="Total">
            <span className="tabular-nums">
              {formatMoney(invoice.totalAmount)}
            </span>
          </DetailField>
          <DetailField label="Payment method">
            {invoice.paymentMethod
              ? (PAYMENT_METHOD_LABELS[invoice.paymentMethod] ??
                invoice.paymentMethod)
              : "Not specified"}
          </DetailField>
          <DetailField label="Status">{statusBadge}</DetailField>
          {invoice.completedAt && (
            <DetailField label="Completed">
              {new Date(invoice.completedAt).toLocaleString()}
            </DetailField>
          )}
        </DetailGrid>
        {invoice.notes && (
          <div className="mt-4">
            <div className="text-muted-foreground mb-1 text-sm font-medium">
              Notes
            </div>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </DetailSection>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Line items
          </CardTitle>
          <CardDescription>
            Products included on this invoice. Each line produces one lot on
            completion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
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
                    const caseWeights = parsePersistedCaseWeights(
                      line.caseWeightsLbs,
                    );
                    const hasDetailedCaseWeights =
                      line.unitType === "catch_weight" && caseWeights.length > 0;
                    const isExpanded = expandedCaseWeightLines.has(line.id);
                    const summary = renderCaseWeightSummary(line.caseWeightsLbs);
                    const patternLabel = getCaseWeightPatternLabel(
                      line.caseWeightsLbs,
                    );

                    return (
                      <Fragment key={line.id}>
                        <TableRow>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {hasDetailedCaseWeights ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleCaseWeightLine(line.id)}
                                  aria-label={
                                    isExpanded
                                      ? "Hide case weight breakdown"
                                      : "Show case weight breakdown"
                                  }
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
                            <Badge
                              variant="outline"
                              className="font-mono text-xs"
                            >
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" />
            Receiving summary
          </CardTitle>
          <CardDescription>
            Lots and inventory items created from this invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allLots.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              {isDraft
                ? "Nothing received yet. Complete the invoice to create lots and inventory."
                : "This invoice did not produce any receiving records."}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <DetailGrid>
                <DetailField label="Lots created">{allLots.length}</DetailField>
                <DetailField label="Inventory items">
                  {allItems.length}
                </DetailField>
                <DetailField label="Total cases">{totalCases}</DetailField>
                <DetailField label="Total weight">
                  <span className="tabular-nums">
                    {totalWeight.toFixed(2)} lbs
                  </span>
                </DetailField>
              </DetailGrid>
              <div className="overflow-x-auto rounded-md border">
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
                                className="font-mono text-sm hover:underline"
                              >
                                {lot.lotNumber}
                              </Link>
                            </TableCell>
                            <TableCell>
                              {formatDisplayDate(lot.expirationDate)}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">
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
                              <Badge
                                variant="outline"
                                className="capitalize"
                              >
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
        </CardContent>
      </Card>

      {invoice.status === "completed" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" />
              Payments
            </CardTitle>
            <CardDescription>
              Payments applied to this supplier invoice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <DetailGrid>
                <DetailField label="Total">
                  <span className="tabular-nums">
                    {formatMoney(paymentSummary.totalAmount)}
                  </span>
                </DetailField>
                <DetailField label="Total paid">
                  <span className="tabular-nums">
                    {formatMoney(paymentSummary.totalPaid)}
                  </span>
                </DetailField>
                <DetailField label="Balance due">
                  <span className="tabular-nums">
                    {formatMoney(paymentSummary.balanceDue)}
                  </span>
                </DetailField>
                <DetailField label="Status">
                  <Badge
                    variant={
                      paymentStatusVariant[paymentSummary.paymentStatus]
                    }
                    className="capitalize"
                  >
                    {paymentStatusLabel[paymentSummary.paymentStatus]}
                  </Badge>
                </DetailField>
              </DetailGrid>
              {invoice.payments.length === 0 ? (
                <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
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
                              <span className="font-mono text-xs">
                                {payment.reference}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground text-xs">
                              {payment.createdBy?.fullName ??
                                payment.createdBy?.email ??
                                "-"}
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
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <SupplierInvoiceAttachmentsCard
        supplierInvoiceId={invoiceId}
        attachments={invoice.attachments}
        canUpload={canEditByRole}
        canRemove={canEditByRole}
        uploadDisabledReason={editDisabledReason}
        removeDisabledReason={editDisabledReason}
      />

      <DetailSection
        title="Activity"
        description="Who touched this invoice and when."
      >
        <SupplierInvoiceActivityTimeline supplierInvoiceId={invoiceId} />
      </DetailSection>

      {isDraft && (
        <DetailSection
          title="Danger zone"
          description="Irreversible actions for this draft."
          className="border-destructive/50"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending || !canDeleteByRole}
            title={deleteDisabledReason}
          >
            <Trash2 className="size-4" />
            Delete draft
          </Button>
        </DetailSection>
      )}

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete & receive invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will post <strong>{invoice.invoiceNumber}</strong> and
              automatically create one lot and one inventory item per line.
              Lot numbers and expirations will use any overrides you entered,
              otherwise they default to{" "}
              <code>LOT-{invoice.invoiceNumber}-XX</code> and receive date + 7
              days. Completed invoices can no longer be edited.
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
                      toast.success(
                        `Invoice "${invoice.invoiceNumber}" posted.`,
                      );
                      setCompleteOpen(false);
                    },
                    onError: err =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Could not complete invoice.",
                      ),
                  },
                );
              }}
            >
              {completeMutation.isPending ? "Posting…" : "Complete & receive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft invoice?</AlertDialogTitle>
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
                    toast.success(
                      `Draft "${invoice.invoiceNumber}" deleted.`,
                    );
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
