import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Sales orders + FIFO — see it in action",
  description:
    "Watch Fluxora take a phone order end-to-end: find the customer, pull stock oldest-first via FIFO, post the invoice with tier pricing — live margin the whole way.",
};

export default function ReelPage() {
  return <Reel />;
}
