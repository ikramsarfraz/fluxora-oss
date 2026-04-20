"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useUpdateUnitOfMeasure } from "@/hooks/use-units-of-measure";
import type { UnitOfMeasureListItem } from "@/services/units-of-measure";

import {
  editUnitFormSchema,
  type EditUnitFormValues,
} from "./edit-unit-dialog.schema";

const emptyValues: EditUnitFormValues = {
  name: "",
  abbreviation: "",
  notes: "",
  sortOrder: "0",
  isActive: true,
};

interface EditUnitDialogProps {
  unit: UnitOfMeasureListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUnitDialog({
  unit,
  open,
  onOpenChange,
}: EditUnitDialogProps) {
  const updateUnit = useUpdateUnitOfMeasure();

  const form = useForm<EditUnitFormValues>({
    resolver: zodResolver(editUnitFormSchema),
    defaultValues: emptyValues,
  });

  const { reset } = form;

  useEffect(() => {
    if (!unit) return;
    reset({
      name: unit.name,
      abbreviation: unit.abbreviation ?? "",
      notes: unit.notes ?? "",
      sortOrder: String(unit.sortOrder),
      isActive: unit.isActive,
    });
  }, [unit, reset]);

  async function onSubmit(data: EditUnitFormValues) {
    if (!unit) return;

    try {
      await updateUnit.mutateAsync({
        id: unit.id,
        data: {
          name: data.name.trim(),
          abbreviation: data.abbreviation.trim() || null,
          notes: data.notes.trim() || null,
          sortOrder: parseInt(data.sortOrder, 10) || 0,
          isActive: data.isActive,
        },
      });
      toast.success("Unit of measure updated.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update unit");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit unit of measure</DialogTitle>
          <DialogDescription>
            Update the details for this unit of measure.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="gap-4">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-name">Name *</FieldLabel>
                  <Input
                    {...field}
                    id="edit-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. Pallet"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="abbreviation"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-abbreviation">Abbreviation</FieldLabel>
                  <Input
                    {...field}
                    id="edit-abbreviation"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. plt"
                    maxLength={16}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="sortOrder"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-sort-order">Sort order</FieldLabel>
                  <Input
                    {...field}
                    id="edit-sort-order"
                    type="number"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Lower numbers appear first in dropdown lists.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="notes"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-notes">Notes</FieldLabel>
                  <Input
                    {...field}
                    id="edit-notes"
                    aria-invalid={fieldState.invalid}
                    placeholder="Optional notes"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Field
                  orientation="horizontal"
                  className="items-center gap-2 space-y-0"
                >
                  <Checkbox
                    id="edit-is-active"
                    checked={field.value}
                    onCheckedChange={c => field.onChange(c === true)}
                  />
                  <FieldLabel
                    htmlFor="edit-is-active"
                    className="cursor-pointer font-normal"
                  >
                    Active
                  </FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateUnit.isPending}>
              {updateUnit.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
