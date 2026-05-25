import { Suspense } from "react";

import UnitsOfMeasure from "../components/units-of-measure-page";

// See orders/routes/list-page.tsx for the prefetch rationale.
export default function UnitsOfMeasureListPage() {
  return (
    <Suspense>
      <UnitsOfMeasure />
    </Suspense>
  );
}
