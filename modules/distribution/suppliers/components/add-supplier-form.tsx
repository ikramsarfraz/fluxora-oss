"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { useCreateSupplier } from "../hooks/use-suppliers";
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

const createSupplierSchema = z.object({
  name: z
    .string()
    .transform(s => s.trim())
    .pipe(z.string().min(1, "Please enter a supplier name.")),
  netDays: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(v => {
      if (v === "" || v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    })
    .pipe(
      z
        .number()
        .int("Payment terms must be a whole number.")
        .min(0, "Payment terms cannot be negative.")
        .max(365, "Payment terms cannot exceed 365 days.")
        .nullable(),
    ),
});

type CreateSupplierValues = z.input<typeof createSupplierSchema>;
type CreateSupplierParsed = z.output<typeof createSupplierSchema>;

export function AddSupplierForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateSupplierValues, unknown, CreateSupplierParsed>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: { name: "", netDays: "" },
  });

  const createSupplier = useCreateSupplier();

  function onSubmit(data: CreateSupplierParsed) {
    setError(null);
    createSupplier.mutate(
      { name: data.name, netDays: data.netDays },
      {
        onSuccess: result => {
          toast.success("Supplier created.");
          router.push(`/suppliers/${result.id}`);
        },
        onError: (e: Error) => setError(e.message),
      },
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-supplier" onSubmit={form.handleSubmit(onSubmit)}>
          {error ? (
            <FormErrorAlert title="We couldn't create the supplier.">
              {error}
            </FormErrorAlert>
          ) : null}
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

            <Controller
              name="netDays"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-supplier-net-days">
                    Payment terms (net days)
                  </FieldLabel>
                  <Input
                    id="form-add-supplier-net-days"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={365}
                    step={1}
                    placeholder="e.g. 30"
                    value={field.value ?? ""}
                    onChange={e => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Days from invoice date until payment is due. Leave blank
                    for Net-0 (due on invoice date). Common values: 0, 7, 15, 30.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <FormActionFooter
        formId="form-add-supplier"
        isPending={createSupplier.isPending}
        onCancel={() => router.push("/suppliers")}
        pendingLabel="Creating…"
        submitLabel="Create supplier"
      />
    </Card>
  );
}
