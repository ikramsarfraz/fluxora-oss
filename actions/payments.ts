"use server";

import {
  getPaymentById,
  getPayments,
} from "@/services/payments";

export async function getPaymentsAction() {
  return await getPayments();
}

export async function getPaymentByIdAction(id: string) {
  return await getPaymentById(id);
}
