"use server";

import {
  createCustomerAction as createCustomerActionImpl,
  deleteCustomerAction as deleteCustomerActionImpl,
  getCustomerAction as getCustomerActionImpl,
  getCustomersAction as getCustomersActionImpl,
  getCustomersPageAction as getCustomersPageActionImpl,
  updateCustomerAction as updateCustomerActionImpl,
} from "@/modules/distribution/customers/actions";

export async function getCustomersAction() {
  return getCustomersActionImpl();
}

export async function getCustomersPageAction(
  ...args: Parameters<typeof getCustomersPageActionImpl>
) {
  return getCustomersPageActionImpl(...args);
}

export async function getCustomerAction(
  ...args: Parameters<typeof getCustomerActionImpl>
) {
  return getCustomerActionImpl(...args);
}

export async function createCustomerAction(
  ...args: Parameters<typeof createCustomerActionImpl>
) {
  return createCustomerActionImpl(...args);
}

export async function updateCustomerAction(
  ...args: Parameters<typeof updateCustomerActionImpl>
) {
  return updateCustomerActionImpl(...args);
}

export async function deleteCustomerAction(
  ...args: Parameters<typeof deleteCustomerActionImpl>
) {
  return deleteCustomerActionImpl(...args);
}
