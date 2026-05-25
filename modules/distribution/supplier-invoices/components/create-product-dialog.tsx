"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddProductForm } from "@/modules/distribution/products/components/add-product-form";

// Modal wrapper around the canonical product form so the bill review can
// surface "+ Create new product" without sending the user away to /products
// and losing their review tab. AddProductForm has been taught to accept
// `initialName`, `onCreated`, and `onCancel` props so this stays a thin
// integration layer.

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vendor product text used to prefill the name field. */
  initialName: string;
  /**
   * Called with the new product's id once `AddProductForm` finishes
   * creating it. The caller is expected to close the dialog and resolve
   * the corresponding review row.
   */
  onCreated: (productId: string) => void;
};

export function CreateProductDialog({
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
          <DialogTitle>Create catalog product</DialogTitle>
          <DialogDescription>
            Fill out the full product profile. This is the same form as
            Settings → Products, so the new product is immediately usable
            for receiving, pricing, and order fulfilment.
          </DialogDescription>
        </DialogHeader>
        <div style={{ padding: "16px 24px 24px" }}>
          <AddProductForm
            initialName={initialName}
            onCreated={result => {
              onOpenChange(false);
              onCreated(result.id);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
