"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  approveExpenseAction,
  markExpensePaidAction,
  rejectExpenseAction,
  resetExpenseToDraftAction,
  submitExpenseAction,
} from "@/modules/distribution/expenses/actions";
import { queryKeys } from "@/lib/query/keys";

/**
 * Hooks for the expense approval transitions. Each wraps a server action,
 * invalidates the detail + list queries on success so the badge + queue
 * refresh together, and exposes the standard isPending / error surface
 * for the buttons to consume.
 */

function invalidateAfterTransition(
  queryClient: ReturnType<typeof useQueryClient>,
  expenseId: string,
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.expenses.detail(expenseId),
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
}

export function useSubmitExpense(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => submitExpenseAction(expenseId),
    onSuccess: () => invalidateAfterTransition(queryClient, expenseId),
  });
}

export function useApproveExpense(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => approveExpenseAction(expenseId),
    onSuccess: () => invalidateAfterTransition(queryClient, expenseId),
  });
}

export function useRejectExpense(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      rejectExpenseAction({ expenseId, reason }),
    onSuccess: () => invalidateAfterTransition(queryClient, expenseId),
  });
}

export function useResetExpenseToDraft(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetExpenseToDraftAction(expenseId),
    onSuccess: () => invalidateAfterTransition(queryClient, expenseId),
  });
}

export function useMarkExpensePaid(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markExpensePaidAction(expenseId),
    onSuccess: () => invalidateAfterTransition(queryClient, expenseId),
  });
}
