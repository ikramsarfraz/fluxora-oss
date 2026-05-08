import { Suspense } from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getExpenses } from "../services/expenses";

import { ExpensesPage } from "../components/expenses-page";

export default async function ExpensesListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.expenses.all,
    queryFn: () => getExpenses(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <ExpensesPage />
      </Suspense>
    </HydrationBoundary>
  );
}
