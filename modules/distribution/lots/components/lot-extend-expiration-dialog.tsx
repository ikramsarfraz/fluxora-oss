"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useUpdateLotExpiration } from "../hooks/use-lots";
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
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LotExtendExpirationDialog({
  open,
  onOpenChange,
  lotId,
  lotNumber,
  currentExpirationDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  lotNumber: string;
  currentExpirationDate: string;
}) {
  const [newDate, setNewDate] = useState(currentExpirationDate);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateLotExpiration();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setNewDate(currentExpirationDate);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!newDate) {
      setError("Expiration date is required.");
      return;
    }

    try {
      await update.mutateAsync({ lotId, expirationDate: newDate });
      toast.success(`Expiration date updated for lot ${lotNumber}.`);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update expiration date.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend expiration date</DialogTitle>
          <DialogDescription>
            Update the expiration date for lot <strong>{lotNumber}</strong>. This affects how expiration state and FEFO priority are calculated for all inventory in this lot.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="new-expiration-date">New expiration date</FieldLabel>
            <Input
              id="new-expiration-date"
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              disabled={update.isPending}
            />
            <FieldDescription>
              Current date: {currentExpirationDate}
            </FieldDescription>
          </Field>

          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending || !newDate}>
              {update.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
