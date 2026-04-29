"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateCategoryAction } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryDetail } from "@/services/categories";

import {
  addCategoryFormSchema,
  type AddCategoryFormValues,
} from "./add-category-form.schema";

export function EditCategoryForm({ category }: { category: CategoryDetail }) {
  const router = useRouter();
  const form = useForm<AddCategoryFormValues>({
    resolver: zodResolver(addCategoryFormSchema),
    defaultValues: {
      name: category.name,
      description: category.description ?? "",
    },
  });

  async function onSubmit(data: AddCategoryFormValues) {
    try {
      await updateCategoryAction({
        id: category.id,
        name: data.name,
        description: data.description || null,
      });
      toast.success(`Category "${data.name}" updated.`);
      router.push(`/categories/${category.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update category.",
      );
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-edit-category" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-edit-category-name">
                    Name *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-edit-category-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. Beef, Chicken, Lamb"
                    autoFocus
                  />
                  <FieldDescription>
                    The slug will be regenerated from the updated name.
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-edit-category-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="form-edit-category-description"
                    aria-invalid={fieldState.invalid}
                    placeholder="Optional description of this category"
                    rows={3}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
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
          onClick={() => router.push(`/categories/${category.id}`)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="form-edit-category"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
