"use client";

import { FileUp, Paperclip } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Placeholder for invoice document uploads (BOL, supplier PDF, packing slip,
 * etc.). The `supplier_invoice_attachments` table already exists; wiring up
 * the actual upload/storage is intentionally out of scope for v1.
 */
export function SupplierInvoiceAttachmentsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4" />
          Supporting documents
        </CardTitle>
        <CardDescription>
          Attach the supplier&apos;s PDF invoice, bill of lading, packing slip,
          or photos of the shipment. Uploads are coming in a follow-up release.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border-muted-foreground/25 bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-10 text-center text-sm">
          <FileUp className="size-8 opacity-50" />
          <div className="font-medium">File uploads not yet available</div>
          <div className="text-xs">
            Placeholder only. Documents will be attached here in a future
            release.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
