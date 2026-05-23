import { Suspense } from "react";

import { PaymentsPage } from "../components/payments-page";

// See orders/routes/list-page.tsx for the prefetch rationale.
export default function PaymentsListPage() {
  return (
    <Suspense>
      <PaymentsPage />
    </Suspense>
  );
}
