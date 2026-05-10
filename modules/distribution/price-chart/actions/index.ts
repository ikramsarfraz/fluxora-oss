"use server";

import {
  applyMarkupToAllCustomers,
  applyMarkupToCustomer,
  deleteCustomerProductPrice,
  deleteProductSupplierCost,
  getPriceChartData,
  promoteProductVendor,
  setCustomerProductPrice,
  setProductDefaultCost,
  setProductSupplierCost,
  updateCustomerFuelSurcharge,
} from "../services/price-chart";

export async function getPriceChartAction() {
  return await getPriceChartData();
}

export async function setCustomerProductPriceAction(
  customerId: string,
  productId: string,
  pricePerLb: string,
) {
  return await setCustomerProductPrice(customerId, productId, pricePerLb);
}

export async function deleteCustomerProductPriceAction(customerId: string, productId: string) {
  return await deleteCustomerProductPrice(customerId, productId);
}

export async function setProductDefaultCostAction(productId: string, costPerLb: string) {
  await setProductDefaultCost(productId, costPerLb);
  await applyMarkupToAllCustomers(productId, costPerLb);
}

export async function applyMarkupToCustomerAction(customerId: string) {
  return await applyMarkupToCustomer(customerId);
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
