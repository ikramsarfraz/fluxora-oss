import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getExpenseById } from "../services/expenses";

import { ExpenseDetailPage } from "../components/expense-detail-page";

export default async function ExpenseDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.expenses.detail(id),
    queryFn: () => getExpenseById(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExpenseDetailPage expenseId={id} />
    </HydrationBoundary>
  );
}
