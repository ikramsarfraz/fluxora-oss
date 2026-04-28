"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useCreateCategory } from "@/hooks/use-categories";

import {
  addCategoryFormSchema,
  type AddCategoryFormValues,
} from "./add-category-form.schema";

const defaultForm: AddCategoryFormValues = {
  name: "",
  description: "",
};

export default function AddCategoryForm() {
  const router = useRouter();
  const createCategory = useCreateCategory();

  const form = useForm<AddCategoryFormValues>({
    resolver: zodResolver(addCategoryFormSchema),
    defaultValues: defaultForm,
  });

  async function onSubmit(data: AddCategoryFormValues) {
    try {
      await createCategory.mutateAsync({
        name: data.name,
        description: data.description || null,
      });
      form.reset(defaultForm);
      toast.success(`Category "${data.name}" created.`);
      router.push("/categories");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create category.",
      );
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-category" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-category-name">
                    Name *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-category-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. Beef, Chicken, Lamb"
                    autoFocus
                  />
                  <FieldDescription>
                    A URL-friendly slug will be generated automatically.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-category-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="form-add-category-description"
                    aria-invalid={fieldState.invalid}
                    placeholder="Optional description of this category"
                    rows={3}
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
          onClick={() => router.push("/categories")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="form-add-category"
          disabled={createCategory.isPending}
        >
          {createCategory.isPending ? "Adding…" : "Add category"}
        </Button>
      </CardFooter>
    </Card>
  );
}
