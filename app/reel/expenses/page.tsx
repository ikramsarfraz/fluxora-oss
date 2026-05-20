import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Expenses — see it in action",
  description:
    "Drop a receipt. Fluxora reads it, categorizes it, posts it to the P&L. No typing.",
};

export default function ReelPage() {
  return <Reel />;
}
