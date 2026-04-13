import { api, endpoints, Supplier } from "@/lib/api";
import { SupplierListItem } from "@/services/suppliers";

export function getSuppliers() {
  return api.get<SupplierListItem[]>(endpoints.suppliers.list());
}

export function getSupplier(id: number) {
  return api.get<Supplier>(endpoints.suppliers.one(id));
}

// export function getCustomerPortfolio(id: number) {
//   return api.get<CustomerPortfolio>(endpoints.customers.portfolio(id));
// }

// export function getCustomerPrices(id: number) {
//   return api.get<CustomerPrice[]>(endpoints.customers.prices(id));
// }

// export function createCustomer(input: {
//   name: string;
//   street?: string;
//   city?: string;
//   state?: string;
//   zip?: string;
//   phone_number?: string;
//   fuel_surcharge_amount?: string;
//   invoice_prefix?: string;
// }) {
//   return api.post<Customer>(endpoints.customers.create(), input);
// }

// export function updateCustomer(
//   id: number,
//   input: Partial<{
//     name: string;
//     street: string;
//     city: string;
//     state: string;
//     zip: string;
//     phone_number: string;
//     fuel_surcharge_amount: string;
//     invoice_prefix: string;
//   }>,
// ) {
//   return api.patch<Customer>(endpoints.customers.update(id), input);
// }

// export function deleteCustomer(id: number) {
//   return api.delete(endpoints.customers.delete(id));
// }
