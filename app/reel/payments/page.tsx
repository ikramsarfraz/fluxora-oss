import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Payments — see it in action",
  description:
    "Record one payment. Watch Fluxora apply it FIFO across open invoices, update aging in real time, and clear the oldest first.",
};

export default function ReelPage() {
  return <Reel />;
}
