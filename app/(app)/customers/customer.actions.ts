"use server";

import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
} from "@/services/customers";
import {
  createCustomerInputSchema,
  type CreateCustomerInput,
} from "./customer.schemas";

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null || v.trim() === "") return null;
  return v.trim();
}

export async function getCustomerAction(customerId: string) {
  return await getCustomerById(customerId);
}

export async function createCustomerAction(input: CreateCustomerInput) {
  const parsed = createCustomerInputSchema.parse(input);
  return await createCustomer({
    ...parsed,
    phoneNumber: emptyToNull(parsed.phoneNumber),
    fuelSurchargeAmount: emptyToNull(parsed.fuelSurchargeAmount),
    invoicePrefix: emptyToNull(parsed.invoicePrefix),
  });
}

export async function deleteCustomerAction(customerId: string) {
  return await deleteCustomer(customerId);
}
