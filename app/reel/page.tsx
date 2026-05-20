import type { Metadata } from "next";

import { DirectoryView } from "./_components/directory-view";

export const metadata: Metadata = {
  title: "Fluxora — see every feature",
  description:
    "A title card for every Fluxora feature. From auth to inventory to AI-powered invoice import — click through and see what each one does.",
};

export default function ReelIndexPage() {
  return <DirectoryView />;
}
