import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/utils/date";
import { isUuid } from "@/lib/utils/uuid";
import { getSalesInvoiceById } from "../services/invoicing";

import { InvoicePdfPreview } from "../components/invoice-pdf-preview";

export default async function InvoicesPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const invoice = await getSalesInvoiceById(id);
  if (!invoice) notFound();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/invoices/${invoice.id}`}>
              <ArrowLeft className="size-4" />
              Back to invoice
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/invoices/${invoice.id}/pdf`}>
              <Download className="size-4" />
              Download PDF
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {invoice.invoiceNumber}
          </h1>
          <div className="text-sm text-muted-foreground">
            PDF preview · Invoice date {formatDisplayDate(invoice.invoiceDate)}
            {invoice.customer ? ` · ${invoice.customer.name}` : ""}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <InvoicePdfPreview
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
        />
      </div>
    </section>
  );
}
