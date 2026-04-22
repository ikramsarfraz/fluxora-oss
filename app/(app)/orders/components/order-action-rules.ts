import type { SalesOrderDetail } from "@/services/orders";

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
  canGenerateInvoice: boolean;
  generateInvoiceReason: string | null;
  canRecordPayment: boolean;
  recordPaymentReason: string | null;
  primaryActionKey: OrderPrimaryActionKey | null;
}

export function getOrderActionAvailability(
  order: SalesOrderDetail,
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

  const editReason =
    order.status === "cancelled"
      ? "Cancelled orders are locked."
      : hasInvoice
        ? "Orders lock after invoicing."
        : hasOperationalActivity
          ? "Editing locks once fulfillment or allocation work has started."
        : null;
  const canEdit = editReason == null;

  const confirmReason =
    order.status === "cancelled"
      ? "Cancelled orders cannot be confirmed."
      : hasInvoice
        ? "Orders with invoices are already financially locked."
        : order.status !== "sales_order"
          ? "This order is already confirmed."
          : !hasLines
            ? "Add at least one line before confirming."
            : null;
  const canConfirm = confirmReason == null;

  const startFulfillmentReason =
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
  const canStartFulfillment = startFulfillmentReason == null;

  const generateInvoiceReason =
    order.status === "cancelled"
      ? "Cancelled orders cannot be invoiced."
      : hasInvoice
        ? "An invoice has already been generated."
        : !hasLines
          ? "Add line items before invoicing."
          : !readyToInvoice
            ? "All lines must be fulfilled or short shipped first."
            : null;
  const canGenerateInvoice = generateInvoiceReason == null;

  const recordPaymentReason =
    !hasInvoice
      ? "Generate an invoice before recording payment."
      : totalInvoiceBalance <= 0
        ? "All invoice balances are already paid."
        : null;
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
    canGenerateInvoice,
    generateInvoiceReason,
    canRecordPayment,
    recordPaymentReason,
    primaryActionKey,
  };
}
