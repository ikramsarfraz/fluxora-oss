"use server";

import { revalidatePath } from "next/cache";

import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  getCustomers,
  getCustomersPage,
  updateCustomer,
  type CustomerListParams,
} from "../services/customers";
import {
  createCustomerInputSchema,
  type CreateCustomerInput,
} from "../validators/customer.schemas";

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null || v.trim() === "") return null;
  return v.trim();
}

export async function getCustomersAction() {
  return await getCustomers();
}

export async function getCustomersPageAction(input?: CustomerListParams) {
  return await getCustomersPage(input);
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

export async function updateCustomerAction(
  customerId: string,
  input: CreateCustomerInput,
) {
  const parsed = createCustomerInputSchema.parse(input);
  const customer = await updateCustomer({
    id: customerId,
    ...parsed,
    phoneNumber: emptyToNull(parsed.phoneNumber),
    fuelSurchargeAmount: emptyToNull(parsed.fuelSurchargeAmount),
    invoicePrefix: emptyToNull(parsed.invoicePrefix),
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/edit`);
  return customer;
}

export async function deleteCustomerAction(customerId: string) {
  return await deleteCustomer(customerId);
}
