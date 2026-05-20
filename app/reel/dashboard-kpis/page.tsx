import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Dashboard KPIs — see it in action",
  description:
    "Open Fluxora in the morning and know the day in five seconds — revenue, margin, aging, top wins, stock at risk. Every number drillable.",
};

export default function ReelPage() {
  return <Reel />;
}
