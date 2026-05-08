"use server";

import {
  getPaymentById,
  getPayments,
  getPaymentsPage,
} from "../services/payments";

export async function getPaymentsAction() {
  return await getPayments();
}

export async function getPaymentsPageAction(
  input?: Parameters<typeof getPaymentsPage>[0],
) {
  return await getPaymentsPage(input);
}

export async function getPaymentByIdAction(id: string) {
  return await getPaymentById(id);
}
