/**
 * Shared mapping from `supplier_invoices.status` enum values → display
 * label + visual tone. Single source of truth so the listing column,
 * detail page status pill, and lifecycle stepper can't drift.
 *
 * The status enum has 6 values:
 *   draft → "Draft"            (neutral — not yet posted to ops)
 *   posted → "Posted"          (info — submitted but not yet receiving)
 *   receiving → "Receiving"    (info — warehouse in progress)
 *   reconciled → "Reconciled"  (info — values match expected)
 *   completed → "Received"     (default — workflow done, payable)
 *   paid → "Paid"              (success — fully paid)
 */

import type { supplierInvoiceStatusEnum } from "@/db/schema";

export type SupplierInvoiceStatus = (typeof supplierInvoiceStatusEnum.enumValues)[number];

export type SupplierInvoiceStatusTone =
  | "neutral"
  | "info"
  | "default"
  | "success";

export type SupplierInvoiceStatusInfo = {
  label: string;
  tone: SupplierInvoiceStatusTone;
};

const STATUS_INFO: Record<SupplierInvoiceStatus, SupplierInvoiceStatusInfo> = {
  draft: { label: "Draft", tone: "neutral" },
  posted: { label: "Posted", tone: "info" },
  receiving: { label: "Receiving", tone: "info" },
  reconciled: { label: "Reconciled", tone: "info" },
  completed: { label: "Received", tone: "default" },
  paid: { label: "Paid", tone: "success" },
};

export function getSupplierInvoiceStatusInfo(
  status: string,
): SupplierInvoiceStatusInfo {
  if (status in STATUS_INFO) {
    return STATUS_INFO[status as SupplierInvoiceStatus];
  }
  // Unknown status — render label-as-status, neutral tone. Should never
  // hit in practice; safety net for future enum additions.
  return { label: status, tone: "neutral" };
}
