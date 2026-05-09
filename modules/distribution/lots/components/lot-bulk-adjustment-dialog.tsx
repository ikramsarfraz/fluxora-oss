"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { useBulkAdjustLotInventory } from "@/modules/distribution/inventory/hooks/use-inventory";
import {
  INVENTORY_ADJUSTMENT_REASON_OPTIONS,
  INVENTORY_STATUS_ADJUSTMENT_OPTIONS,
} from "@/lib/warehouse/adjustments";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function LotBulkAdjustmentDialog({
  open,
  onOpenChange,
  lotId,
  lotNumber,
  adjustableCount,
  lockedCount,
  defaultTargetStatus,
  disabledReason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  lotNumber: string;
  adjustableCount: number;
  lockedCount: number;
  defaultTargetStatus: "damaged" | "expired";
  disabledReason?: string | null;
}) {
  const bulkAdjust = useBulkAdjustLotInventory();
  const [targetStatus, setTargetStatus] = useState<
    "in_stock" | "damaged" | "expired"
  >(defaultTargetStatus);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTargetStatus(defaultTargetStatus);
      setReason(defaultTargetStatus === "expired" ? "expired" : "damaged");
      setNotes("");
      setSubmitError(null);
    }
  }, [defaultTargetStatus, open, lotId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmitError(null);
      if (!reason) {
        throw new Error("Choose an adjustment reason.");
      }

      const result = await bulkAdjust.mutateAsync({
        lotId,
        targetStatus,
        reason,
        notes: notes.trim() || null,
      });

      toast.success(
        `Updated ${result.affectedInventoryItemCount} inventory item${
          result.affectedInventoryItemCount === 1 ? "" : "s"
        } in lot ${lotNumber}.`,
      );
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not run lot action.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lot action</DialogTitle>
          <DialogDescription>
            Apply a controlled bulk correction to eligible inventory in lot{" "}
            {lotNumber}. One adjustment record will be created per affected
            inventory item.
          </DialogDescription>
        </DialogHeader>

        {disabledReason ? (
          <Alert>
            <ShieldAlert />
            <AlertTitle>Lot actions unavailable</AlertTitle>
            <AlertDescription>{disabledReason}</AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not run lot action</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="font-medium">{adjustableCount} eligible inventory item(s)</p>
            <p className="mt-1 text-muted-foreground">
              {lockedCount > 0
                ? `${lockedCount} item(s) are locked because they are allocated, fulfilled, shipped, or sold.`
                : "All inventory in this lot is currently eligible for the selected lot action."}
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="lot-adjustment-status">Action</FieldLabel>
            <Select
              value={targetStatus}
              onValueChange={value =>
                setTargetStatus(value as "in_stock" | "damaged" | "expired")
              }
              disabled={Boolean(disabledReason) || bulkAdjust.isPending}
            >
              <SelectTrigger id="lot-adjustment-status">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_STATUS_ADJUSTMENT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Use this to bulk expire, damage, or restore eligible inventory in
              the lot.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="lot-adjustment-reason">Reason</FieldLabel>
            <Select
              value={reason}
              onValueChange={setReason}
              disabled={Boolean(disabledReason) || bulkAdjust.isPending}
            >
              <SelectTrigger id="lot-adjustment-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_ADJUSTMENT_REASON_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!reason ? (
              <FieldError errors={[{ message: "Adjustment reason is required." }]} />
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="lot-adjustment-notes">Notes</FieldLabel>
            <Textarea
              id="lot-adjustment-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Why is this lot action needed?"
              disabled={Boolean(disabledReason) || bulkAdjust.isPending}
            />
          </Field>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                Boolean(disabledReason) ||
                adjustableCount === 0 ||
                bulkAdjust.isPending
              }
            >
              {bulkAdjust.isPending ? "Applying..." : "Apply lot action"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
