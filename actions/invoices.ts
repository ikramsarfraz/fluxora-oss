"use server";

import {
  getSalesInvoiceById,
  getSalesInvoices,
  getSalesInvoicesPage,
} from "@/services/invoicing";

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
