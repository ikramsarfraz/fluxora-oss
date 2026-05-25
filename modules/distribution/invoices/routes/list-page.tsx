import { Suspense } from "react";

import Invoices from "../components/invoices-page";

// See orders/routes/list-page.tsx for the prefetch rationale.
export default function InvoicesListPage() {
  return (
    <Suspense>
      <Invoices />
    </Suspense>
  );
}
