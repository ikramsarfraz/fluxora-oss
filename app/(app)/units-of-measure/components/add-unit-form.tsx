"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useCreateUnitOfMeasure } from "@/hooks/use-units-of-measure";

import {
  addUnitFormSchema,
  type AddUnitFormValues,
} from "./add-unit-form.schema";

const defaultForm: AddUnitFormValues = {
  name: "",
  abbreviation: "",
  notes: "",
  sortOrder: "0",
};

export default function AddUnitForm() {
  const router = useRouter();
  const createUnit = useCreateUnitOfMeasure();

  const form = useForm<AddUnitFormValues>({
    resolver: zodResolver(addUnitFormSchema),
    defaultValues: defaultForm,
  });

  async function onSubmit(data: AddUnitFormValues) {
    try {
      await createUnit.mutateAsync({
        name: data.name.trim(),
        abbreviation: data.abbreviation.trim() || undefined,
        notes: data.notes.trim() || undefined,
        sortOrder: parseInt(data.sortOrder, 10) || 0,
      });
      form.reset(defaultForm);
      toast.success("Unit of measure created.");
      router.push("/units-of-measure");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create unit");
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-unit" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-unit-name">Name *</FieldLabel>
                  <Input
                    {...field}
                    id="form-add-unit-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. Pallet, Case, Each"
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
                  <FieldLabel htmlFor="form-add-unit-abbreviation">
                    Abbreviation
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-unit-abbreviation"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. plt, cs, ea"
                    maxLength={16}
                  />
                  <FieldDescription>
                    Optional short form for display in tables and reports.
                  </FieldDescription>
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
                  <FieldLabel htmlFor="form-add-unit-sort-order">
                    Sort order
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-unit-sort-order"
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
                  <FieldLabel htmlFor="form-add-unit-notes">Notes</FieldLabel>
                  <Input
                    {...field}
                    id="form-add-unit-notes"
                    aria-invalid={fieldState.invalid}
                    placeholder="Optional notes about this unit"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/units-of-measure")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="form-add-unit"
          disabled={createUnit.isPending}
        >
          {createUnit.isPending ? "Adding…" : "Add unit"}
        </Button>
      </CardFooter>
    </Card>
  );
}
