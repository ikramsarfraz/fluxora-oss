import { Suspense } from "react";

import Lots from "../components/lots-page";

// See orders/routes/list-page.tsx for the prefetch rationale.
export default function LotsListPage() {
  return (
    <Suspense>
      <Lots />
    </Suspense>
  );
}
