"use server";

import {
  getOpenInvoicesForCustomer,
  getOpenInvoicesForPayment,
  getSalesInvoiceById,
  getSalesInvoices,
  getSalesInvoicesPage,
  getSalesInvoicesSummary,
  recordBulkPaymentForCustomer,
  type SalesInvoiceFilters,
} from "../services/invoicing";

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
