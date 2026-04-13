import { api, endpoints, Product } from "@/lib/api";
import { ProductListItem } from "@/services/products";

export function getProducts() {
  return api.get<ProductListItem[]>(endpoints.products.list());
}

export function getProduct(id: number) {
  return api.get<Product>(endpoints.products.one(id));
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
