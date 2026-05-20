import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Stripe Checkout — see it in action",
  description:
    "Pick a plan, pay in a Stripe-hosted Checkout, watch features unlock the moment the webhook lands.",
};

export default function ReelPage() {
  return <Reel />;
}
