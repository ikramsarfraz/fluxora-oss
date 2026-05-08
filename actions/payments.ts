"use server";

import {
  getPaymentByIdAction as getPaymentByIdActionImpl,
  getPaymentsAction as getPaymentsActionImpl,
  getPaymentsPageAction as getPaymentsPageActionImpl,
} from "@/modules/distribution/payments/actions";

export async function getPaymentsAction() {
  return getPaymentsActionImpl();
}

export async function getPaymentsPageAction(
  ...args: Parameters<typeof getPaymentsPageActionImpl>
) {
  return getPaymentsPageActionImpl(...args);
}

export async function getPaymentByIdAction(
  ...args: Parameters<typeof getPaymentByIdActionImpl>
) {
  return getPaymentByIdActionImpl(...args);
}
