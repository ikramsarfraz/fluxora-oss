import type { Metadata } from "next";

import { InvoiceImportDemo } from "./invoice-import-demo";

export const metadata: Metadata = {
  title: "Invoice import",
};

export default function InvoiceImportPage() {
  return <InvoiceImportDemo />;
}
