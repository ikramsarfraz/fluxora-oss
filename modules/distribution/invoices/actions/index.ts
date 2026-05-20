"use server";

import {
  getOpenInvoicesForPayment,
  getSalesInvoiceById,
  getSalesInvoices,
  getSalesInvoicesPage,
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
