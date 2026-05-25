import { redirect } from "next/navigation";

// `/bill-payments` is now a tab inside the unified `/payments` hub.
// Detail pages at `/bill-payments/[id]` continue to live here.
export default function BillPaymentsListRedirect() {
  redirect("/payments?tab=bill");
}
