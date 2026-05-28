"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateCategoryAction } from "@/modules/distribution/categories/actions";
import { Card, CardContent } from "@/components/ui/card";
import { FormActionFooter } from "@/components/forms/form-action-footer";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryDetail } from "../services/categories";

import {
  addCategoryFormSchema,
  type AddCategoryFormValues,
} from "./add-category-form.schema";

export function EditCategoryForm({ category }: { category: CategoryDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AddCategoryFormValues>({
    resolver: zodResolver(addCategoryFormSchema),
    defaultValues: {
      name: category.name,
      description: category.description ?? "",
    },
  });

  async function onSubmit(data: AddCategoryFormValues) {
    setError(null);
    try {
      await updateCategoryAction({
        id: category.id,
        name: data.name,
        description: data.description || null,
      });
      toast.success("Category updated.");
      router.push(`/settings/workspace/categories/${category.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update category.",
      );
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-edit-category" onSubmit={form.handleSubmit(onSubmit)}>
          {error ? (
            <FormErrorAlert title="We couldn't save your changes.">
              {error}
            </FormErrorAlert>
          ) : null}
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
      <FormActionFooter
        formId="form-edit-category"
        isPending={form.formState.isSubmitting}
        onCancel={() =>
          router.push(`/settings/workspace/categories/${category.id}`)
        }
        pendingLabel="Saving…"
        submitLabel="Save changes"
      />
    </Card>
  );
}
