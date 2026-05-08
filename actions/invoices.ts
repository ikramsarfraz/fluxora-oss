"use server";

import {
  getSalesInvoiceByIdAction as getSalesInvoiceByIdActionImpl,
  getSalesInvoicesAction as getSalesInvoicesActionImpl,
  getSalesInvoicesPageAction as getSalesInvoicesPageActionImpl,
} from "@/modules/distribution/invoices/actions";

export async function getSalesInvoicesAction() {
  return getSalesInvoicesActionImpl();
}

export async function getSalesInvoicesPageAction(
  ...args: Parameters<typeof getSalesInvoicesPageActionImpl>
) {
  return getSalesInvoicesPageActionImpl(...args);
}

export async function getSalesInvoiceByIdAction(
  ...args: Parameters<typeof getSalesInvoiceByIdActionImpl>
) {
  return getSalesInvoiceByIdActionImpl(...args);
}
