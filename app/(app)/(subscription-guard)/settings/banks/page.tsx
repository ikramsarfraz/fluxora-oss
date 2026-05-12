import { Suspense } from "react";
import { getConnectedBanks } from "@/modules/distribution/plaid/actions";
import { BanksSettingsPage } from "@/modules/distribution/plaid/components/banks-settings-page";

async function BanksContent() {
  const banks = await getConnectedBanks();
  return <BanksSettingsPage initialBanks={banks} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "#78716c" }}>Loading…</div>}>
      <BanksContent />
    </Suspense>
  );
}
