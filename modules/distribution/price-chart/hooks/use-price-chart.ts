"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyMarkupToCustomerAction,
  deleteCustomerProductPriceAction,
  deleteProductSupplierCostAction,
  getCustomerProductPricesPageAction,
  getPriceChartAction,
  promoteProductVendorAction,
  setCustomerProductPriceAction,
  setProductSupplierCostAction,
  updateCustomerFuelSurchargeAction,
} from "@/modules/distribution/price-chart/actions";
import { queryKeys } from "@/lib/query/keys";
import type { CustomerProductsParams } from "@/modules/distribution/price-chart/services/price-chart";

function invalidatePriceChart(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.priceChart.all });
}

export function usePriceChart() {
  return useQuery({
    queryKey: queryKeys.priceChart.all,
    queryFn: getPriceChartAction,
    staleTime: 1000 * 60 * 2,
  });
}

export function useSetCustomerPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerId: string;
      productId: string;
      pricePerLb: string;
      /** Optional: scope the price to a specific supplier (overrides the default for that supplier). */
      supplierId?: string | null;
    }) =>
      setCustomerProductPriceAction(
        input.customerId,
        input.productId,
        input.pricePerLb,
        input.supplierId ?? null,
      ),
    onSuccess: () => invalidatePriceChart(queryClient),
  });
}

export function useDeleteCustomerPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerId: string;
      productId: string;
      supplierId?: string | null;
    }) =>
      deleteCustomerProductPriceAction(
        input.customerId,
        input.productId,
        input.supplierId ?? null,
      ),
    onSuccess: () => invalidatePriceChart(queryClient),
  });
}

export function useApplyMarkupToCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId: string; markupPercent: number }) =>
      applyMarkupToCustomerAction(input.customerId, input.markupPercent),
    onSuccess: () => invalidatePriceChart(queryClient),
  });
}

export function useUpdateCustomerFuelSurcharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId: string; fuelSurchargeAmount: string | null }) =>
      updateCustomerFuelSurchargeAction(input.customerId, input.fuelSurchargeAmount),
    onSuccess: () => invalidatePriceChart(queryClient),
  });
}

export function useSetProductSupplierCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; supplierId: string; costPerLb: string }) =>
      setProductSupplierCostAction(input.productId, input.supplierId, input.costPerLb),
    onSuccess: () => invalidatePriceChart(queryClient),
  });
}

export function useDeleteProductSupplierCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; supplierId: string }) =>
      deleteProductSupplierCostAction(input.productId, input.supplierId),
    onSuccess: () => invalidatePriceChart(queryClient),
  });
}

export function usePromoteProductVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; supplierId: string }) =>
      promoteProductVendorAction(input.productId, input.supplierId),
    onSuccess: () => invalidatePriceChart(queryClient),
  });
}

export function useCustomerProductPricesPage(customerId: string, params: CustomerProductsParams) {
  return useQuery({
    queryKey: queryKeys.priceChart.customerProducts(customerId, params),
    queryFn: () => getCustomerProductPricesPageAction(customerId, params),
    enabled: !!customerId,
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 2,
  });
}
