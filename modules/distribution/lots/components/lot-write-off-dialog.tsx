"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useWriteOffLotAsLoss } from "../hooks/use-lots";
import { INVENTORY_ADJUSTMENT_REASON_OPTIONS } from "@/lib/warehouse/adjustments";
import { formatMoney } from "@/lib/utils/currency";
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

type WriteOffStatus = "expired" | "damaged";

const STATUS_OPTIONS: { value: WriteOffStatus; label: string }[] = [
  { value: "expired", label: "Expired — stock past its expiration date" },
  { value: "damaged", label: "Damaged — stock is unsellable due to damage" },
];

export function LotWriteOffDialog({
  open,
  onOpenChange,
  lotId,
  lotNumber,
  eligibleItemCount,
  estimatedLossValue,
  disabledReason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  lotNumber: string;
  eligibleItemCount: number;
  estimatedLossValue: number;
  disabledReason?: string | null;
}) {
  const [targetStatus, setTargetStatus] = useState<WriteOffStatus>("expired");
  const [reason, setReason] = useState("expired");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const writeOff = useWriteOffLotAsLoss();

  useEffect(() => {
    if (open) {
      // Reset form each time the dialog opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetStatus("expired");
      setReason("expired");
      setNotes("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    // Keep reason in sync with the chosen target status.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReason(targetStatus === "expired" ? "expired" : "damaged");
  }, [targetStatus]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setNotes("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!reason) {
      setError("Select a reason before continuing.");
      return;
    }

    try {
      const result = await writeOff.mutateAsync({
        lotId,
        targetStatus,
        reason,
        notes: notes.trim() || null,
      });
      toast.success(
        `Wrote off ${result.affectedItemCount} item(s) from lot ${lotNumber}. Loss of ${formatMoney(result.totalLoss.toFixed(2))} recorded as an expense.`,
      );
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not write off lot.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Write off lot as loss</DialogTitle>
          <DialogDescription>
            Record why this stock is being removed and confirm the financial write-off. The cost will be logged as an expense.
          </DialogDescription>
        </DialogHeader>

        {disabledReason ? (
          <p className="text-sm font-medium text-destructive">{disabledReason}</p>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-1">
            <p className="font-medium">{eligibleItemCount} eligible item(s) affected</p>
            <p className="text-muted-foreground">
              Estimated write-off value:{" "}
              <span className="font-medium text-foreground">{formatMoney(estimatedLossValue.toFixed(2))}</span>
              {" "}— recorded as an &quot;Inventory write-off&quot; expense.
            </p>
            <p className="text-muted-foreground text-xs">
              Items that are allocated, fulfilled, shipped, or sold are excluded.
            </p>
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="write-off-status">Why is this stock being removed?</FieldLabel>
            <Select
              value={targetStatus}
              onValueChange={v => setTargetStatus(v as WriteOffStatus)}
              disabled={Boolean(disabledReason) || writeOff.isPending}
            >
              <SelectTrigger id="write-off-status">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              This determines how the inventory status is recorded.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="write-off-reason">Adjustment reason</FieldLabel>
            <Select
              value={reason}
              onValueChange={setReason}
              disabled={Boolean(disabledReason) || writeOff.isPending}
            >
              <SelectTrigger id="write-off-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_ADJUSTMENT_REASON_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!reason && (
              <FieldError errors={[{ message: "Adjustment reason is required." }]} />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="write-off-notes">Notes (optional)</FieldLabel>
            <Textarea
              id="write-off-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Inspection findings, incident details, approver name…"
              disabled={Boolean(disabledReason) || writeOff.isPending}
            />
          </Field>

          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={writeOff.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={Boolean(disabledReason) || eligibleItemCount === 0 || !reason || writeOff.isPending}
            >
              {writeOff.isPending ? "Processing..." : "Write off and record loss"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
