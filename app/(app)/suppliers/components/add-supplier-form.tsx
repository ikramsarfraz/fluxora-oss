"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, endpoints, type Supplier } from "@/lib/api";
import { queryKeys } from "@/lib/query/keys";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const createSupplierSchema = z.object({
  name: z
    .string()
    .transform(s => s.trim())
    .pipe(z.string().min(1, "Please enter a supplier name.")),
});

type CreateSupplierValues = z.infer<typeof createSupplierSchema>;

export function AddSupplierForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateSupplierValues>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: { name: "" },
  });

  const createSupplier = useMutation({
    mutationFn: (body: { name: string }) =>
      api.post<Supplier>(endpoints.suppliers.create(), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
      form.reset();
      setError(null);
      toast.success("Supplier added");
      router.push("/suppliers");
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(data: CreateSupplierValues) {
    setError(null);
    createSupplier.mutate({ name: data.name });
  }

  return (
    <Card className="w-full max-w-xl border-0 bg-transparent p-0 shadow-none ring-0">
      <CardHeader className="px-0 pt-0">
        <CardTitle id="add-supplier-heading" className="text-[1.1rem]">
          Add supplier
        </CardTitle>
        <CardDescription>
          Create a supplier for lots, purchases, and supplier invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form id="form-add-supplier" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-supplier-name">
                    Supplier name *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-supplier-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. ABC Meat Co."
                    autoComplete="organization"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            {error && (
              <div className="text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2 border-0 bg-transparent px-0 pt-0">
        <Field orientation="horizontal" className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Reset
          </Button>
          <Button
            type="submit"
            form="form-add-supplier"
            disabled={createSupplier.isPending}
          >
            {createSupplier.isPending ? "Adding…" : "Add supplier"}
          </Button>
        </Field>
      </CardFooter>
    </Card>
  );
}
