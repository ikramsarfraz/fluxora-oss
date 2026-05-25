import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Roles & permissions — see it in action",
  description:
    "Design roles. Watch the same workspace render differently for each person — and every action audit-logged server-side.",
};

export default function ReelPage() {
  return <Reel />;
}
