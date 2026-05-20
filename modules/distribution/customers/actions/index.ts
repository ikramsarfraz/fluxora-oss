"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import {
  archiveCustomer,
  bulkCreateCustomers,
  createCustomer,
  deleteCustomerPrice,
  exportCustomersCsv,
  findCustomerImportConflicts,
  getCustomerById,
  getCustomerInvoicesPage,
  getCustomerOrdersPage,
  getCustomerPortfolio,
  getCustomerPrices,
  getCustomers,
  getCustomersPage,
  permanentlyDeleteCustomer,
  restoreCustomer,
  searchCustomers,
  setCustomerPrice,
  suggestInvoicePrefix,
  updateCustomer,
  type BulkCreateCustomerInput,
  type BulkCreateCustomersResult,
  type CustomerArchivedFilter,
  type CustomerImportConflict,
  type CustomerInvoicesParams,
  type CustomerListParams,
  type CustomerOrdersParams,
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

export async function searchCustomersAction(query?: string, limit?: number) {
  return await searchCustomers(query ?? "", limit);
}

export async function suggestInvoicePrefixAction(
  fromName: string,
  excludeCustomerId?: string,
): Promise<string> {
  return await suggestInvoicePrefix(fromName, excludeCustomerId);
}

export async function exportCustomersCsvAction(
  archived: CustomerArchivedFilter = "all",
): Promise<{ filename: string; csv: string }> {
  return await exportCustomersCsv(archived);
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
  });
}

export async function bulkCreateCustomersAction(
  rows: BulkCreateCustomerInput[],
): Promise<BulkCreateCustomersResult> {
  const result = await bulkCreateCustomers(rows);
  if (result.created > 0) {
    revalidatePath("/customers");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function findCustomerImportConflictsAction(
  rows: ReadonlyArray<{ name?: string; email?: string }>,
): Promise<CustomerImportConflict[]> {
  return await findCustomerImportConflicts(rows);
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
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/edit`);
  return customer;
}

export async function archiveCustomerAction(customerId: string) {
  const [user, customer] = await Promise.all([
    getCurrentPortalUser(),
    getCustomerById(customerId),
  ]);
  const result = await archiveCustomer(customerId);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "customer.archive",
    resourceType: "customer",
    resourceId: customerId,
    metadata: customer ? { name: customer.name } : {},
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return result;
}

export async function restoreCustomerAction(customerId: string) {
  const [user, customer] = await Promise.all([
    getCurrentPortalUser(),
    getCustomerById(customerId),
  ]);
  const result = await restoreCustomer(customerId);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "customer.restore",
    resourceType: "customer",
    resourceId: customerId,
    metadata: customer ? { name: customer.name } : {},
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return result;
}

export async function permanentlyDeleteCustomerAction(customerId: string) {
  const [user, customer] = await Promise.all([
    getCurrentPortalUser(),
    getCustomerById(customerId),
  ]);
  const result = await permanentlyDeleteCustomer(customerId);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "customer.delete",
    resourceType: "customer",
    resourceId: customerId,
    metadata: customer ? { name: customer.name } : {},
  });
  revalidatePath("/customers");
  return result;
}

export async function getCustomerPortfolioAction(customerId: string) {
  return await getCustomerPortfolio(customerId);
}

export async function getCustomerPricesAction(customerId: string) {
  return await getCustomerPrices(customerId);
}

export async function setCustomerPriceAction(
  customerId: string,
  productId: string,
  pricePerLb: string,
) {
  return await setCustomerPrice(customerId, productId, pricePerLb);
}

export async function deleteCustomerPriceAction(customerId: string, productId: string) {
  return await deleteCustomerPrice(customerId, productId);
}

export async function getCustomerOrdersPageAction(customerId: string, params?: CustomerOrdersParams) {
  return await getCustomerOrdersPage(customerId, params);
}

export async function getCustomerInvoicesPageAction(customerId: string, params?: CustomerInvoicesParams) {
  return await getCustomerInvoicesPage(customerId, params);
}
