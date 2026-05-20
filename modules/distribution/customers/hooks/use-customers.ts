"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveCustomerAction,
  createCustomerAction,
  getCustomerAction,
  getCustomerInvoicesPageAction,
  getCustomerOrdersPageAction,
  getCustomerPortfolioAction,
  getCustomersAction,
  getCustomersPageAction,
  permanentlyDeleteCustomerAction,
  restoreCustomerAction,
} from "@/modules/distribution/customers/actions";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type {
  CustomerInvoicesParams,
  CustomerListParams,
  CustomerOrdersParams,
} from "@/modules/distribution/customers/services/customers";

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.all,
    queryFn: getCustomersAction,
    staleTime: 1000 * 60 * 5,
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

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
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
    },
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function usePermanentlyDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: permanentlyDeleteCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
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
