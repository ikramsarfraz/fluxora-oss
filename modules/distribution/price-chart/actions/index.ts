"use server";

import {
  applyMarkupToCustomer,
  deleteCustomerProductPrice,
  deleteProductSupplierCost,
  getCustomerProductPricesPage,
  getPriceChartData,
  promoteProductVendor,
  setCustomerProductPrice,
  setProductSupplierCost,
  updateCustomerFuelSurcharge,
  type CustomerProductsParams,
} from "../services/price-chart";

export async function getPriceChartAction() {
  return await getPriceChartData();
}

export async function setCustomerProductPriceAction(
  customerId: string,
  productId: string,
  pricePerLb: string,
  supplierId: string | null = null,
) {
  return await setCustomerProductPrice(customerId, productId, pricePerLb, supplierId);
}

export async function deleteCustomerProductPriceAction(
  customerId: string,
  productId: string,
  supplierId: string | null = null,
) {
  return await deleteCustomerProductPrice(customerId, productId, supplierId);
}

export async function applyMarkupToCustomerAction(customerId: string, markupPercent?: number) {
  return await applyMarkupToCustomer(customerId, markupPercent);
}

export async function updateCustomerFuelSurchargeAction(
  customerId: string,
  fuelSurchargeAmount: string | null,
) {
  return await updateCustomerFuelSurcharge(customerId, fuelSurchargeAmount);
}

export async function setProductSupplierCostAction(
  productId: string,
  supplierId: string,
  costPerLb: string,
) {
  return await setProductSupplierCost(productId, supplierId, costPerLb);
}

export async function deleteProductSupplierCostAction(productId: string, supplierId: string) {
  return await deleteProductSupplierCost(productId, supplierId);
}

export async function promoteProductVendorAction(productId: string, supplierId: string) {
  return await promoteProductVendor(productId, supplierId);
}

export async function getCustomerProductPricesPageAction(
  customerId: string,
  input?: CustomerProductsParams,
) {
  return await getCustomerProductPricesPage(customerId, input);
}
