"use server";

import {
  getOpenInvoicesForCustomer,
  getOpenInvoicesForPayment,
  getSalesInvoiceById,
  getSalesInvoicePaymentsPage,
  getSalesInvoices,
  getSalesInvoicesPage,
  getSalesInvoicesSummary,
  recordBulkPaymentForCustomer,
  type SalesInvoiceFilters,
} from "../services/invoicing";
import { checkInvoiceSendPreview } from "./check-invoice-send-preview";
import { sendInvoiceToCustomerAction } from "./send-invoice";

export async function getSalesInvoicesAction() {
  return await getSalesInvoices();
}

export async function getSalesInvoicesPageAction(
  input?: Parameters<typeof getSalesInvoicesPage>[0],
) {
  return await getSalesInvoicesPage(input);
}

export async function getSalesInvoiceByIdAction(id: string) {
  return await getSalesInvoiceById(id);
}

export async function getSalesInvoicePaymentsPageAction(invoiceId: string) {
  return await getSalesInvoicePaymentsPage(invoiceId);
}

export async function getOpenInvoicesForPaymentAction(
  input: { search?: string; limit?: number } = {},
) {
  return await getOpenInvoicesForPayment(input);
}

export async function getSalesInvoicesSummaryAction(
  filters: SalesInvoiceFilters = {},
  search: string = "",
) {
  return await getSalesInvoicesSummary(filters, search);
}

export async function getOpenInvoicesForCustomerAction(customerId: string) {
  return await getOpenInvoicesForCustomer(customerId);
}

export async function recordBulkPaymentForCustomerAction(
  input: Parameters<typeof recordBulkPaymentForCustomer>[0],
) {
  return await recordBulkPaymentForCustomer(input);
}

export async function checkInvoiceSendPreviewAction(salesInvoiceId: string) {
  return await checkInvoiceSendPreview(salesInvoiceId);
}

// Re-exported so client code only needs to import from the actions
// barrel (modal calls this via a React Query mutation).
export { sendInvoiceToCustomerAction };
