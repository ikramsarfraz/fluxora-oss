"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveCustomerAction,
  createCustomerAction,
  getCustomerAction,
  getCustomerCreditSnapshotAction,
  getCustomerInvoicesPageAction,
  getCustomerOrdersPageAction,
  getCustomerPortfolioAction,
  getCustomersAction,
  getCustomersPageAction,
  permanentlyDeleteCustomerAction,
  restoreCustomerAction,
  searchCustomersAction,
} from "@/modules/distribution/customers/actions";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type {
  CustomerInvoicesParams,
  CustomerListParams,
  CustomerOrdersParams,
} from "@/modules/distribution/customers/services/customers";

/**
 * @deprecated Loads every active customer into the client. Past a few
 * hundred rows this becomes a real perf problem. Prefer
 * {@link useCustomerSearch} for typeahead and {@link useCustomer} for
 * single-customer lookups by id.
 */
export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.all,
    queryFn: getCustomersAction,
    staleTime: 1000 * 60 * 5,
  });
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Server-paginated typeahead. Returns up to ~20 matching active customers
 * (lightweight rows: id, name, abbreviation, phone, email, fuel surcharge,
 * net days, default address). Use the resulting `id` to look up the full
 * customer record via {@link useCustomer} when needed.
 */
export function useCustomerSearch(query: string, limit?: number) {
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  return useQuery({
    queryKey: queryKeys.customers.search(debouncedQuery),
    queryFn: () => searchCustomersAction(debouncedQuery, limit),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 30,
  });
}

export function useCustomersPage(params: CustomerListParams) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => getCustomersPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomerAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCustomerPortfolio(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.portfolio(id),
    queryFn: () => getCustomerPortfolioAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Just-enough credit data for the new-order customer chip: open AR
 * balance + configured credit limit. Cheaper than fetching the full
 * portfolio for forms that only need exposure-at-a-glance.
 */
export function useCustomerCreditSnapshot(id: string) {
  return useQuery({
    queryKey: [...queryKeys.customers.detail(id), "credit-snapshot"] as const,
    queryFn: () => getCustomerCreditSnapshotAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 30,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      // The price-chart screen's top-level query bundles the customer list;
      // an add elsewhere needs to show up there too.
      queryClient.invalidateQueries({ queryKey: queryKeys.priceChart.all });
      invalidateSetupChecklistQuery(queryClient);
    },
  });
}

export function useArchiveCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.priceChart.all });
    },
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.priceChart.all });
    },
  });
}

export function usePermanentlyDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: permanentlyDeleteCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.priceChart.all });
    },
  });
}

export function useCustomerOrdersPage(id: string, params: CustomerOrdersParams) {
  return useQuery({
    queryKey: queryKeys.customers.ordersPage(id, params),
    queryFn: () => getCustomerOrdersPageAction(id, params),
    enabled: !!id && isUuid(id),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCustomerInvoicesPage(id: string, params: CustomerInvoicesParams) {
  return useQuery({
    queryKey: queryKeys.customers.invoicesPage(id, params),
    queryFn: () => getCustomerInvoicesPageAction(id, params),
    enabled: !!id && isUuid(id),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 2,
  });
}
