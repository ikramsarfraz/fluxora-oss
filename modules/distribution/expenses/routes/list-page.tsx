import { Suspense } from "react";

import { ExpensesPage } from "../components/expenses-page";

// Client drives its own paginated query. See orders/routes/list-page.tsx
// for the rationale on why server prefetching here was a net negative.
export default function ExpensesListPage() {
  return (
    <Suspense>
      <ExpensesPage />
    </Suspense>
  );
}
