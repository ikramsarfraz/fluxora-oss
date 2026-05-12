import { Suspense } from "react";
import { getBankActivity } from "@/modules/distribution/plaid/services/bank-activity";
import { BankActivityShell } from "@/modules/distribution/plaid/components/bank-activity-shell";

async function BankActivityContent() {
  const data = await getBankActivity("all");
  return <BankActivityShell data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "#78716c" }}>Loading…</div>}>
      <BankActivityContent />
    </Suspense>
  );
}
