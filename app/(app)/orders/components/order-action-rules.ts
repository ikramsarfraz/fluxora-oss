import type { SalesOrderDetail } from "@/services/orders";
import {
  can,
  getPermissionDeniedReason,
  type OrderPermission,
  type PortalUserRole,
} from "@/lib/auth/permissions";

import { getLineRemainingQuantity } from "./order-fulfillment-utils";

export type OrderPrimaryActionKey =
  | "confirm-order"
  | "start-fulfillment"
  | "generate-invoice"
  | "record-payment";

export interface OrderActionAvailability {
  hasInvoice: boolean;
  isPaid: boolean;
  hasLines: boolean;
  hasOpenLines: boolean;
  readyToInvoice: boolean;
  totalInvoiceBalance: number;
  totalInvoiceAmount: number;
  canEdit: boolean;
  editReason: string | null;
  canConfirm: boolean;
  confirmReason: string | null;
  canStartFulfillment: boolean;
  startFulfillmentReason: string | null;
  canFulfill: boolean;
  fulfillReason: string | null;
  canShortShip: boolean;
  shortShipReason: string | null;
  canReverseFulfillment: boolean;
  reverseFulfillmentReason: string | null;
  canGenerateInvoice: boolean;
  generateInvoiceReason: string | null;
  canRecordPayment: boolean;
  recordPaymentReason: string | null;
  primaryActionKey: OrderPrimaryActionKey | null;
}

/**
 * Layer a role permission on top of a workflow-state reason. Workflow state
 * takes precedence in the message — if the state already blocks, we surface
 * that reason first; otherwise fall back to the role reason when denied.
 */
function layerPermission(
  workflowReason: string | null,
  role: PortalUserRole | null | undefined,
  permission: OrderPermission,
): string | null {
  if (workflowReason) return workflowReason;
  if (role === undefined) return null;
  if (!can(role, permission)) return getPermissionDeniedReason(permission);
  return null;
}

/**
 * Compute availability for all sales-order actions.
 *
 * When `role` is provided, role-based permissions are layered on top of the
 * existing workflow rules — an action is allowed only when both the workflow
 * state and the role allow it. When `role` is omitted (`undefined`), only
 * workflow rules apply (useful for read-only previews / legacy callers).
 */
export function getOrderActionAvailability(
  order: SalesOrderDetail,
  role?: PortalUserRole | null,
): OrderActionAvailability {
  const invoices = order.invoices ?? [];
  const hasInvoice = invoices.length > 0;
  const totalInvoiceBalance = invoices.reduce(
    (sum, invoice) => sum + (parseFloat(invoice.balanceDue ?? "0") || 0),
    0,
  );
  const totalInvoiceAmount = invoices.reduce(
    (sum, invoice) => sum + (parseFloat(invoice.totalAmount ?? "0") || 0),
    0,
  );
  const isPaid = hasInvoice && totalInvoiceAmount > 0 && totalInvoiceBalance <= 0;
  const lines = order.lines ?? [];
  const hasLines = lines.length > 0;
  const hasOpenLines = lines.some(line => getLineRemainingQuantity(line) > 0);
  const readyToInvoice =
    hasLines &&
    lines.every(
      line =>
        line.shortShippedAt != null || line.fulfilledCases >= line.expectedCases,
    );
  const hasOperationalActivity = lines.some(
    line =>
      line.shortShippedAt != null ||
      line.fulfilledCases > 0 ||
      (line.fulfillments?.length ?? 0) > 0 ||
      (line.allocations?.length ?? 0) > 0,
  );

  const editWorkflowReason =
    order.status === "cancelled"
      ? "Cancelled orders are locked."
      : hasInvoice
        ? "Orders lock after invoicing."
        : hasOperationalActivity
          ? "Editing locks once fulfillment or allocation work has started."
          : null;
  const editReason = layerPermission(editWorkflowReason, role, "edit_order");
  const canEdit = editReason == null;

  const confirmWorkflowReason =
    order.status === "cancelled"
      ? "Cancelled orders cannot be confirmed."
      : hasInvoice
        ? "Orders with invoices are already financially locked."
        : order.status !== "sales_order"
          ? "This order is already confirmed."
          : !hasLines
            ? "Add at least one line before confirming."
            : null;
  const confirmReason = layerPermission(
    confirmWorkflowReason,
    role,
    "confirm_order",
  );
  const canConfirm = confirmReason == null;

  const startFulfillmentWorkflowReason =
    order.status === "cancelled"
      ? "Cancelled orders cannot be fulfilled."
      : hasInvoice
        ? "Invoiced orders are closed for new fulfillment."
        : order.status === "sales_order"
          ? "Confirm the order before starting fulfillment."
          : !hasLines
            ? "Add line items before starting fulfillment."
            : !hasOpenLines
              ? "All lines are already closed."
              : null;
  const startFulfillmentReason = layerPermission(
    startFulfillmentWorkflowReason,
    role,
    "fulfill_order",
  );
  const canStartFulfillment = startFulfillmentReason == null;

  // Recording fulfillment is broader than starting: allowed whenever the
  // order is not cancelled/invoiced and there is still open demand.
  const fulfillWorkflowReason =
    order.status === "cancelled"
      ? "Cancelled orders cannot be fulfilled."
      : hasInvoice
        ? "Invoiced orders are closed for new fulfillment."
        : !hasLines
          ? "Add line items before recording fulfillment."
          : !hasOpenLines
            ? "All lines are already closed."
            : null;
  const fulfillReason = layerPermission(
    fulfillWorkflowReason,
    role,
    "fulfill_order",
  );
  const canFulfill = fulfillReason == null;

  const shortShipWorkflowReason =
    order.status === "cancelled"
      ? "Cancelled orders cannot be short shipped."
      : hasInvoice
        ? "Invoiced orders can no longer be short shipped."
        : !hasLines
          ? "Add line items before closing a line short."
          : !hasOpenLines
            ? "All lines are already closed."
            : null;
  const shortShipReason = layerPermission(
    shortShipWorkflowReason,
    role,
    "short_ship_order",
  );
  const canShortShip = shortShipReason == null;

  const reverseFulfillmentWorkflowReason = hasInvoice
    ? "Reverse actions are locked after invoicing."
    : null;
  const reverseFulfillmentReason = layerPermission(
    reverseFulfillmentWorkflowReason,
    role,
    "reverse_fulfillment",
  );
  const canReverseFulfillment = reverseFulfillmentReason == null;

  const generateInvoiceWorkflowReason =
    order.status === "cancelled"
      ? "Cancelled orders cannot be invoiced."
      : hasInvoice
        ? "An invoice has already been generated."
        : !hasLines
          ? "Add line items before invoicing."
          : !readyToInvoice
            ? "All lines must be fulfilled or short shipped first."
            : null;
  const generateInvoiceReason = layerPermission(
    generateInvoiceWorkflowReason,
    role,
    "generate_invoice",
  );
  const canGenerateInvoice = generateInvoiceReason == null;

  const recordPaymentWorkflowReason = !hasInvoice
    ? "Generate an invoice before recording payment."
    : totalInvoiceBalance <= 0
      ? "All invoice balances are already paid."
      : null;
  const recordPaymentReason = layerPermission(
    recordPaymentWorkflowReason,
    role,
    "record_payment",
  );
  const canRecordPayment = recordPaymentReason == null;

  let primaryActionKey: OrderPrimaryActionKey | null = null;
  if (order.status === "cancelled") {
    primaryActionKey = null;
  } else if (hasInvoice) {
    primaryActionKey = "record-payment";
  } else if (readyToInvoice) {
    primaryActionKey = "generate-invoice";
  } else if (order.status === "confirmed") {
    primaryActionKey = "start-fulfillment";
  } else {
    primaryActionKey = "confirm-order";
  }

  return {
    hasInvoice,
    isPaid,
    hasLines,
    hasOpenLines,
    readyToInvoice,
    totalInvoiceBalance,
    totalInvoiceAmount,
    canEdit,
    editReason,
    canConfirm,
    confirmReason,
    canStartFulfillment,
    startFulfillmentReason,
    canFulfill,
    fulfillReason,
    canShortShip,
    shortShipReason,
    canReverseFulfillment,
    reverseFulfillmentReason,
    canGenerateInvoice,
    generateInvoiceReason,
    canRecordPayment,
    recordPaymentReason,
    primaryActionKey,
  };
}
