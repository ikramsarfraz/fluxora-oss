"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createExpenseAction,
  deleteExpenseAction,
  getExpenseByIdAction,
  getExpensesAction,
  getExpensesPageAction,
  updateExpenseAction,
} from "@/actions/expenses";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type { ExpenseListParams } from "@/modules/distribution/expenses/services/expenses";

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses.all,
    queryFn: getExpensesAction,
    staleTime: 1000 * 60,
  });
}

export function useExpensesPage(params: ExpenseListParams) {
  return useQuery({
    queryKey: queryKeys.expenses.list(params),
    queryFn: () => getExpensesPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60,
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: queryKeys.expenses.detail(id),
    queryFn: () => getExpenseByIdAction(id),
    enabled: isUuid(id),
    staleTime: 1000 * 60,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExpenseAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateExpenseAction,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.detail(variables.id),
      });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExpenseAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
  });
}
