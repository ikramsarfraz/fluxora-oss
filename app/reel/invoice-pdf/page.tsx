import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Invoice PDF — see it in action",
  description:
    "Set your letterhead once. Watch Fluxora compose a branded invoice PDF, attach it to an email, and deliver to your customer's inbox.",
};

export default function ReelPage() {
  return <Reel />;
}
