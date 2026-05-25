import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Onboarding — see it in action",
  description:
    "Pick a subdomain, name your workspace, invite your team, knock out the setup checklist — all in under two minutes.",
};

export default function ReelPage() {
  return <Reel />;
}
