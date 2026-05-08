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
  const [correctedCases, setCorrectedCases] = useState("");
  const [correctedWeightLbs, setCorrectedWeightLbs] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTargetStatus("unchanged");
      setCorrectedCases("");
      setCorrectedWeightLbs("");
      setReason("");
      setNotes("");
      setSubmitError(null);
    }
  }, [open, item.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmitError(null);
      if (!reason) {
        throw new Error("Choose an adjustment reason.");
      }

      await adjustInventory.mutateAsync({
        inventoryItemId: item.id,
        targetStatus: targetStatus === "unchanged" ? null : targetStatus,
        correctedCases:
          correctedCases.trim().length > 0
            ? Number.parseInt(correctedCases, 10)
            : null,
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
          <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Current status</p>
              <p className="font-medium">{getInventoryStatusLabel(item.status)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current cases</p>
              <p className="font-medium">{item.cases}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current weight</p>
              <p className="font-medium">{formatWeightLbs(item.exactWeightLbs)} lb</p>
            </div>
          </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="inventory-adjustment-cases">
                Corrected cases
              </FieldLabel>
              <Input
                id="inventory-adjustment-cases"
                inputMode="numeric"
                placeholder={String(item.cases)}
                value={correctedCases}
                onChange={event => setCorrectedCases(event.target.value)}
                disabled={Boolean(disabledReason) || adjustInventory.isPending}
              />
              <FieldDescription>
                Leave blank to keep the current case count.
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
          </div>

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
              disabled={Boolean(disabledReason) || adjustInventory.isPending}
            >
              {adjustInventory.isPending ? "Saving..." : "Record adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
