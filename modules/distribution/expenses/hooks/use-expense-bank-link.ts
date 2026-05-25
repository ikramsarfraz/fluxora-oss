"use client";

import { useQuery } from "@tanstack/react-query";

import { getLinkedBankTransactionForExpenseAction } from "@/modules/distribution/expenses/actions";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useExpenseBankLink(expenseId: string) {
  return useQuery({
    queryKey: queryKeys.expenses.bankLink(expenseId),
    queryFn: () => getLinkedBankTransactionForExpenseAction(expenseId),
    enabled: isUuid(expenseId),
    staleTime: 1000 * 30,
  });
}
