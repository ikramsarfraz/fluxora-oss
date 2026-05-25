import { Suspense } from "react";

import { PaymentsHub } from "./payments-hub";

export default function PaymentsHubPage() {
  return (
    <Suspense>
      <PaymentsHub />
    </Suspense>
  );
}
