"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddSupplierForm } from "@/modules/distribution/suppliers/components/add-supplier-form";

// Modal wrapper around the canonical supplier form. Surfaced from the bill
// review when the parser detected an unmatched supplier candidate — the
// header text is prefilled into the name field so the user just confirms /
// adjusts and saves.

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Supplier name extracted from the invoice header — used as the prefill. */
  initialName: string;
  /**
   * Called once the supplier is created. Callers set the form's supplierId
   * value here so the bill review immediately reflects the new match.
   */
  onCreated: (supplier: { id: string; name: string }) => void;
};

export function CreateSupplierDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl"
        style={{ padding: 0 }}
      >
        <DialogHeader style={{ padding: "20px 24px 0" }}>
          <DialogTitle>Create supplier from invoice</DialogTitle>
          <DialogDescription>
            We pulled this name from the invoice header. Confirm or adjust
            it, optionally set payment terms, and save — the supplier is
            assigned to this bill automatically.
          </DialogDescription>
        </DialogHeader>
        <div style={{ padding: "16px 24px 24px" }}>
          <AddSupplierForm
            initialName={initialName}
            onCreated={supplier => {
              onOpenChange(false);
              onCreated(supplier);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
