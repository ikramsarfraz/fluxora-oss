"use client";

import { FileText, Paperclip } from "lucide-react";

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
 *
 * The placeholder used to be a hand-rolled card with inline styles that
 * didn't match the detail page's `Card` / `CardHeader` / `CardTitle`
 * primitives — switched to the same shadcn components + empty-state
 * styling so the form and the detail page read as one design system.
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
          Attach the supplier&apos;s PDF invoice, bill of lading, packing
          slip, or photos of the shipment. Max 25 MB per file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mirrors the empty state on the detail page's
            SupplierInvoiceAttachmentsCard so the user sees the same
            visual shape before vs after the draft is created. */}
        <div className="border-muted-foreground/25 bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-10 text-center text-sm">
          <FileText className="size-8 opacity-50" />
          <div className="font-medium">No documents attached yet</div>
          <div className="text-xs">
            Save the draft first to enable uploads — the upload control
            shows up on the bill detail page once the draft is created.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
