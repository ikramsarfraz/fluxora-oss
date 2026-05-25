import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Plaid bank link — see it in action",
  description:
    "Link the bank once. Watch Fluxora pull transactions and auto-match each one to an invoice, bill, or expense.",
};

export default function ReelPage() {
  return <Reel />;
}
