import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Customer bulk import — see it in action",
  description:
    "Watch eighteen customers go from a tired Excel sheet into Fluxora in under five seconds — no field-by-field typing, no copy-paste.",
};

export default function ReelPage() {
  return <Reel />;
}
