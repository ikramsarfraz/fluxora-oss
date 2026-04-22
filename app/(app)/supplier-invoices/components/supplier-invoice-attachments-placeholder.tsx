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
 * Shown on the create/edit form only. Real attachment upload lives on the
 * supplier invoice detail page where we have a stable `supplierInvoiceId`
 * to attach files to (see `SupplierInvoiceAttachmentsCard`).
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
          or photos of the shipment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border-muted-foreground/25 bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-10 text-center text-sm">
          <FileUp className="size-8 opacity-50" />
          <div className="font-medium">
            Save the draft to attach documents
          </div>
          <div className="text-xs">
            Uploads are available from the invoice detail page once the draft
            exists.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
