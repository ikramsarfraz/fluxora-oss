import { Suspense } from "react";

import Suppliers from "../components/suppliers-page";

// See orders/routes/list-page.tsx for the prefetch rationale.
export default function SuppliersListPage() {
  return (
    <Suspense>
      <Suppliers />
    </Suspense>
  );
}
