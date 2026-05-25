import type { Metadata } from "next";

import { Reel } from "./reel";

export const metadata: Metadata = {
  title: "Invoice import — see it in action",
  description:
    "Watch the PDF invoice import flow run end-to-end. Drop a supplier invoice, AI extracts the line items, you confirm — products and stock land in inventory.",
};

export default function ReelPage() {
  return <Reel />;
}
