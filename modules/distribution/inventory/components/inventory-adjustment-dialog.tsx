"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { useAdjustInventoryItem } from "../hooks/use-inventory";
import {
  INVENTORY_ADJUSTMENT_REASON_OPTIONS,
  INVENTORY_STATUS_ADJUSTMENT_OPTIONS,
} from "../utils/adjustments";
import { formatWeightLbs, getInventoryStatusLabel } from "../utils/insights";
import { formatMoney } from "@/lib/utils/currency";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryDetail } from "../services/inventory";

export function InventoryAdjustmentDialog({
  open,
  onOpenChange,
  item,
  disabledReason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryDetail;
  disabledReason?: string | null;
}) {
  const adjustInventory = useAdjustInventoryItem();
  const [targetStatus, setTargetStatus] = useState<
    "unchanged" | "in_stock" | "damaged" | "expired"
  >("unchanged");
  const [correctedWeightLbs, setCorrectedWeightLbs] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Explicit confirmation gate for destructive operations — marking damaged/
  // expired (or taking weight off a catch-weight item) creates a permanent
  // write-off expense entry. Default off; user must opt in before submit.
  const [confirmWriteOff, setConfirmWriteOff] = useState(false);

  const cost = Number(item.costPerUnitSnapshot ?? 0);
  const isCatchWeight = item.costUnitTypeSnapshot === "catch_weight";
  const nextStatusResolved = targetStatus === "unchanged" ? item.status : targetStatus;
  const nextWeightResolved = correctedWeightLbs.trim() !== "" ? Number(correctedWeightLbs) : Number(item.exactWeightLbs);

  const writeOffLoss = (() => {
    if (cost === 0) return 0;
    const isWriteOff = nextStatusResolved === "damaged" || nextStatusResolved === "expired";
    const isRestore = nextStatusResolved === "in_stock";
    if (isRestore) return 0;
    if (isWriteOff) {
      return isCatchWeight ? cost * Number(item.exactWeightLbs) : cost;
    }
    // Weight correction without status change (catch-weight only)
    const weightDelta = Number(item.exactWeightLbs) - (Number.isFinite(nextWeightResolved) ? nextWeightResolved : Number(item.exactWeightLbs));
    return isCatchWeight && weightDelta > 0 ? cost * weightDelta : 0;
  })();

  // A destructive adjustment is one that will create a write-off expense:
  // moving the item to damaged/expired, or shaving weight off a catch-weight
  // item. Returning stock to in_stock or doing a zero-cost correction is not.
  const isDestructiveAdjustment =
    nextStatusResolved === "damaged" ||
    nextStatusResolved === "expired" ||
    writeOffLoss > 0;

  useEffect(() => {
    if (open) {
      setTargetStatus("unchanged");
      setCorrectedWeightLbs("");
      setReason("");
      setNotes("");
      setSubmitError(null);
      setConfirmWriteOff(false);
    }
  }, [open, item.id]);

  // Re-arm the confirmation any time the user changes status or weight — the
  // checkbox should only "stick" for the exact configuration the user reviewed.
  useEffect(() => {
    setConfirmWriteOff(false);
  }, [targetStatus, correctedWeightLbs]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmitError(null);
      if (!reason) {
        throw new Error("Choose an adjustment reason.");
      }
      if (isDestructiveAdjustment && !confirmWriteOff) {
        throw new Error("Confirm the write-off to record this adjustment.");
      }

      await adjustInventory.mutateAsync({
        inventoryItemId: item.id,
        targetStatus: targetStatus === "unchanged" ? null : targetStatus,
        correctedWeightLbs:
          correctedWeightLbs.trim().length > 0 ? correctedWeightLbs.trim() : null,
        reason,
        notes: notes.trim() || null,
      });

      toast.success("Inventory adjusted.");
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not adjust inventory.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adjust inventory</DialogTitle>
          <DialogDescription>
            Record a controlled warehouse correction for {item.barcodeId}. This
            creates an adjustment record instead of silently editing stock in
            place.
          </DialogDescription>
        </DialogHeader>

        {disabledReason ? (
          <Alert>
            <ShieldAlert />
            <AlertTitle>Adjustments unavailable</AlertTitle>
            <AlertDescription>{disabledReason}</AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not record adjustment</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Current status</p>
              <p className="font-medium">{getInventoryStatusLabel(item.status)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current weight</p>
              <p className="font-medium">{formatWeightLbs(item.exactWeightLbs)} lb</p>
            </div>
          </div>

          {isDestructiveAdjustment && (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <div>
                {writeOffLoss > 0 ? (
                  <p className="font-medium text-destructive">
                    Write-off: {formatMoney(writeOffLoss.toFixed(2))}
                  </p>
                ) : (
                  <p className="font-medium text-destructive">
                    {nextStatusResolved === "expired" ? "Marking expired" : "Marking damaged"}
                  </p>
                )}
                <p className="mt-0.5 text-muted-foreground">
                  {writeOffLoss > 0
                    ? "This adjustment will create an “Inventory write-off” expense entry for the lost value. This cannot be undone automatically."
                    : "This adjustment changes the item’s status and is recorded in the audit trail. Reverse it manually if needed."}
                </p>
              </div>
              <label
                className="flex cursor-pointer items-start gap-2 text-sm"
                htmlFor="inventory-adjustment-confirm"
              >
                <Checkbox
                  id="inventory-adjustment-confirm"
                  checked={confirmWriteOff}
                  onCheckedChange={value => setConfirmWriteOff(value === true)}
                  disabled={Boolean(disabledReason) || adjustInventory.isPending}
                />
                <span>
                  I confirm this adjustment{writeOffLoss > 0 ? " and accept the write-off" : ""}.
                </span>
              </label>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="inventory-adjustment-status">
              Status change
            </FieldLabel>
            <Select
              value={targetStatus}
              onValueChange={value =>
                setTargetStatus(
                  value as "unchanged" | "in_stock" | "damaged" | "expired",
                )
              }
              disabled={Boolean(disabledReason) || adjustInventory.isPending}
            >
              <SelectTrigger id="inventory-adjustment-status">
                <SelectValue placeholder="No status change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">No status change</SelectItem>
                {INVENTORY_STATUS_ADJUSTMENT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Use this to mark stock damaged, expired, or return it to in stock.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="inventory-adjustment-weight">
              Corrected weight lbs
            </FieldLabel>
            <Input
              id="inventory-adjustment-weight"
              inputMode="decimal"
              placeholder={formatWeightLbs(item.exactWeightLbs)}
              value={correctedWeightLbs}
              onChange={event => setCorrectedWeightLbs(event.target.value)}
              disabled={Boolean(disabledReason) || adjustInventory.isPending}
            />
            <FieldDescription>
              Leave blank to keep the current exact weight.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="inventory-adjustment-reason">Reason</FieldLabel>
            <Select
              value={reason}
              onValueChange={setReason}
              disabled={Boolean(disabledReason) || adjustInventory.isPending}
            >
              <SelectTrigger id="inventory-adjustment-reason">
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
            <FieldLabel htmlFor="inventory-adjustment-notes">
              Notes
            </FieldLabel>
            <Textarea
              id="inventory-adjustment-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Why is this correction needed?"
              disabled={Boolean(disabledReason) || adjustInventory.isPending}
            />
          </Field>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                Boolean(disabledReason) ||
                adjustInventory.isPending ||
                (isDestructiveAdjustment && !confirmWriteOff)
              }
            >
              {adjustInventory.isPending ? "Saving..." : "Record adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
