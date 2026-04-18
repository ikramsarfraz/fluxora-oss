"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useUpdateUnitOfMeasure } from "@/hooks/use-units-of-measure";
import type { UnitOfMeasureListItem } from "@/services/units-of-measure";

interface EditUnitDialogProps {
  unit: UnitOfMeasureListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUnitDialog({ unit, open, onOpenChange }: EditUnitDialogProps) {
  const updateUnit = useUpdateUnitOfMeasure();

  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [notes, setNotes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (unit) {
      setName(unit.name);
      setAbbreviation(unit.abbreviation ?? "");
      setNotes(unit.notes ?? "");
      setSortOrder(String(unit.sortOrder));
      setIsActive(unit.isActive);
    }
  }, [unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unit) return;

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      await updateUnit.mutateAsync({
        id: unit.id,
        data: {
          name: name.trim(),
          abbreviation: abbreviation.trim() || null,
          notes: notes.trim() || null,
          sortOrder: parseInt(sortOrder, 10) || 0,
          isActive,
        },
      });
      toast.success("Unit of measure updated.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update unit");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Unit of Measure</DialogTitle>
          <DialogDescription>
            Update the details for this unit of measure.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pallet"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-abbreviation">Abbreviation</Label>
            <Input
              id="edit-abbreviation"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="e.g. plt"
              maxLength={16}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sort-order">Sort Order</Label>
            <Input
              id="edit-sort-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-is-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="edit-is-active" className="font-normal">
              Active
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateUnit.isPending}>
              {updateUnit.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
