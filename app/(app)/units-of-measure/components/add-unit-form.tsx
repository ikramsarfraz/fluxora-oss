"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { useCreateUnitOfMeasure } from "@/hooks/use-units-of-measure";

export default function AddUnitForm() {
  const router = useRouter();
  const createUnit = useCreateUnitOfMeasure();

  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [notes, setNotes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      await createUnit.mutateAsync({
        name: name.trim(),
        abbreviation: abbreviation.trim() || undefined,
        notes: notes.trim() || undefined,
        sortOrder: parseInt(sortOrder, 10) || 0,
      });
      toast.success("Unit of measure created.");
      router.push("/units-of-measure");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create unit");
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <form id="form-add-unit" onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="add-name">Name *</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pallet, Case, Each"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-abbreviation">Abbreviation</Label>
            <Input
              id="add-abbreviation"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="e.g. plt, cs, ea"
              maxLength={16}
            />
            <p className="text-xs text-muted-foreground">
              Optional short form for display in tables and reports.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-sort-order">Sort Order</Label>
            <Input
              id="add-sort-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in dropdown lists.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-notes">Notes</Label>
            <Input
              id="add-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this unit"
            />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/units-of-measure")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createUnit.isPending}>
            {createUnit.isPending ? "Adding..." : "Add Unit"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
