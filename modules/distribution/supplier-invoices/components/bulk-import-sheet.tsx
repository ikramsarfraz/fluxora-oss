"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { BulkImportPanel } from "./bulk-import-panel";

/**
 * Right-side sheet that hosts the bulk-import dropzone + parse-progress UI.
 *
 * Replaces the dedicated `/supplier-invoices/bulk-import` route — uploads now
 * happen in-place from `SupplierBillsShell` so the underlying inbox list
 * stays visible while files parse. Modal would block the list; a centered
 * dialog risks accidental dismiss mid-upload. A right-side sheet is the
 * right pattern for 30s–5min multi-file workflows.
 *
 * The sheet is purely a chrome wrapper — `BulkImportPanel` owns the upload
 * state, mutation, IndexedDB blob staging, and the post-parse results view.
 * Closing the sheet doesn't cancel an in-flight upload (the mutation lives
 * on the server action) but the user won't see the per-file progress once
 * the sheet is gone. PR follow-up: persist the in-flight state to the queue
 * cache so closing the sheet doesn't hide live progress.
 */
export function BulkImportSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Wider than the default sheet so the file-list rows + per-file
        // status pills + action buttons all fit without truncation. ~720px
        // works on most laptop widths.
        className="w-full overflow-y-auto sm:max-w-[720px]"
      >
        <SheetHeader className="border-b border-stone-line">
          <SheetTitle>Bulk import supplier bills</SheetTitle>
          <SheetDescription>
            Drop or pick supplier-invoice PDFs. Each one is parsed and added to
            your Inbox once it&apos;s ready to review.
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <BulkImportPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
