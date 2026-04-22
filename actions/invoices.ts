"use server";

import {
  getSalesInvoiceById,
  getSalesInvoices,
} from "@/services/invoicing";

export async function getSalesInvoicesAction() {
  return await getSalesInvoices();
}

export async function getSalesInvoiceByIdAction(id: string) {
  return await getSalesInvoiceById(id);
}
