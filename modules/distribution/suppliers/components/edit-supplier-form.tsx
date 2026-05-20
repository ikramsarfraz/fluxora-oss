"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { updateSupplierAction } from "@/modules/distribution/suppliers/actions";
import { NetTermsLegend } from "./net-terms-legend";
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
import type { SupplierDetail } from "../services/suppliers";

const editSupplierSchema = z.object({
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

type EditSupplierValues = z.input<typeof editSupplierSchema>;
type EditSupplierParsed = z.output<typeof editSupplierSchema>;

export function EditSupplierForm({ supplier }: { supplier: SupplierDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EditSupplierValues, unknown, EditSupplierParsed>({
    resolver: zodResolver(editSupplierSchema),
    defaultValues: {
      name: supplier.name,
      netDays: supplier.netDays ?? "",
    },
  });

  async function onSubmit(data: EditSupplierParsed) {
    setError(null);
    try {
      await updateSupplierAction({
        id: supplier.id,
        name: data.name,
        netDays: data.netDays,
      });
      toast.success("Supplier updated.");
      router.push(`/suppliers/${supplier.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update supplier.");
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-edit-supplier" onSubmit={form.handleSubmit(onSubmit)}>
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
                  <FieldLabel htmlFor="form-edit-supplier-name">
                    Supplier name *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-edit-supplier-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. ABC Meat Co."
                    autoComplete="organization"
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              name="netDays"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-edit-supplier-net-days">
                    Payment terms (net days)
                  </FieldLabel>
                  <Input
                    id="form-edit-supplier-net-days"
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
                    for Net-0.
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                  <NetTermsLegend />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <FormActionFooter
        formId="form-edit-supplier"
        isPending={form.formState.isSubmitting}
        onCancel={() => router.push(`/suppliers/${supplier.id}`)}
        pendingLabel="Saving…"
        submitLabel="Save changes"
      />
    </Card>
  );
}
