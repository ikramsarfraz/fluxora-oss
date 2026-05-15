"use client";

import { ExternalLink, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { SupplierInvoiceDetail } from "../services/receiving";

type Attachment = SupplierInvoiceDetail["attachments"][number];

/**
 * Inline PDF preview on the supplier-invoice detail page. Picks the most
 * recently uploaded PDF attachment and renders it via an <iframe> pointing at
 * the existing /api/supplier-invoices/[id]/attachments/[fileId] route — the
 * browser's built-in PDF viewer takes over from there, so we get scroll,
 * zoom, search, and download for free without bundling PDF.js client-side
 * for this surface.
 *
 * Returns null when no PDF attachment is present so the section disappears
 * entirely rather than rendering an empty card.
 */
export function SupplierInvoicePdfPreviewCard({
  supplierInvoiceId,
  attachments,
}: {
  supplierInvoiceId: string;
  attachments: Attachment[];
}) {
  const pdf = pickPreviewPdf(attachments);
  if (!pdf) return null;

  const href = `/api/supplier-invoices/${supplierInvoiceId}/attachments/${pdf.file.id}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Source PDF
          </CardTitle>
          <CardDescription className="truncate font-mono">
            {pdf.file.originalFilename ?? "attachment.pdf"}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Open in new tab
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        <iframe
          src={`${href}#view=FitH`}
          title={pdf.file.originalFilename ?? "Source PDF"}
          className="h-[640px] w-full rounded-md border border-stone-line bg-stone-line2"
        />
      </CardContent>
    </Card>
  );
}

function pickPreviewPdf(attachments: Attachment[]): Attachment | null {
  // Most recent first — `attachments` already arrives sorted by createdAt desc
  // from the receiving service. We just need to pick the first item whose
  // file is a PDF (by mime or filename extension).
  for (const attachment of attachments) {
    const mime = attachment.file.mimeType?.toLowerCase() ?? "";
    const name = attachment.file.originalFilename?.toLowerCase() ?? "";
    if (mime === "application/pdf" || name.endsWith(".pdf")) {
      return attachment;
    }
  }
  return null;
}
