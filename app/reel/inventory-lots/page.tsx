import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Inventory + lot ledger — see it in action",
  description:
    "Watch Fluxora's inventory page: SKU list, expiry-aware filters, lot timeline with FIFO indicator, movement ledger, and a spoilage adjustment that updates on-hand in real time.",
};

export default function ReelPage() {
  return <Reel />;
}
