"use server";

import {
  getBillPaymentById,
  getBillPaymentsPage,
  getBillPaymentsSummary,
  getOpenBillsForPayment,
  type BillPaymentFilters,
  type BillPaymentListParams,
} from "../services/supplier-payments";

export async function getBillPaymentsPageAction(input?: BillPaymentListParams) {
  return await getBillPaymentsPage(input);
}

export async function getBillPaymentByIdAction(id: string) {
  return await getBillPaymentById(id);
}

export async function getBillPaymentsSummaryAction(
  filters: BillPaymentFilters = {},
  search: string = "",
) {
  return await getBillPaymentsSummary(filters, search);
}

export async function getOpenBillsForPaymentAction(
  input: { search?: string; limit?: number } = {},
) {
  return await getOpenBillsForPayment(input);
}
