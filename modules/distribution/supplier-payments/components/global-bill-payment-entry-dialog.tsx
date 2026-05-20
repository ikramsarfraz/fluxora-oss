"use client";

/**
 * Placeholder dialog until step 5 wires the full bill picker. Keeps the
 * listing page compiling and the "Record payment" button visible so the
 * QA path stays intact across commits.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalBillPaymentEntryDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record bill payment</DialogTitle>
          <DialogDescription>
            Picker UI lands in step 5. For now, record a payment from a
            specific bill detail page.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
