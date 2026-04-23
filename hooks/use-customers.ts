"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCustomerAction,
  createCustomerAction,
  deleteCustomerAction,
  getCustomersAction,
} from "@/actions/customers";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.all,
    queryFn: getCustomersAction,
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

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomerAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}
