"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { useUpdateSupplier } from "../hooks/use-suppliers";
import { NetTermsLegend } from "@/modules/shared/components/net-terms-legend";
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
import type { SupplierDetail } from "../services/suppliers";

const optionalText = (max: number) =>
  z
    .string()
    .transform(s => s.trim())
    .refine(s => s.length <= max, `Cannot exceed ${max} characters.`)
    .transform(s => (s === "" ? null : s))
    .nullable();

const optionalEmail = z
  .string()
  .transform(s => s.trim().toLowerCase())
  .refine(
    s => s === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
    "Enter a valid email address.",
  )
  .refine(s => s.length <= 320, "Email cannot exceed 320 characters.")
  .transform(s => (s === "" ? null : s))
  .nullable();

const optionalEin = z
  .string()
  .transform(s => s.trim())
  .refine(
    s => s === "" || /^\d{2}-?\d{7}$/.test(s),
    "Tax ID must be a 9-digit US EIN (e.g. 12-3456789).",
  )
  .transform(s => (s === "" ? null : s))
  .nullable();

const optionalUrl = z
  .string()
  .transform(s => s.trim())
  .refine(s => {
    if (s === "") return true;
    try {
      const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid website URL.")
  .refine(s => s.length <= 512, "Website cannot exceed 512 characters.")
  .transform(s => (s === "" ? null : s))
  .nullable();

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
  primaryContactName: optionalText(255),
  primaryContactEmail: optionalEmail,
  primaryContactPhone: optionalText(32),
  taxId: optionalEin,
  accountNumber: optionalText(64),
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  addressCity: optionalText(128),
  addressRegion: optionalText(128),
  addressPostalCode: optionalText(32),
  websiteUrl: optionalUrl,
  notes: optionalText(4000),
});

type EditSupplierValues = z.input<typeof editSupplierSchema>;
type EditSupplierParsed = z.output<typeof editSupplierSchema>;

export function EditSupplierForm({ supplier }: { supplier: SupplierDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const updateSupplier = useUpdateSupplier();

  const form = useForm<EditSupplierValues, unknown, EditSupplierParsed>({
    resolver: zodResolver(editSupplierSchema),
    defaultValues: {
      name: supplier.name,
      netDays: supplier.netDays ?? "",
      primaryContactName: supplier.primaryContactName ?? "",
      primaryContactEmail: supplier.primaryContactEmail ?? "",
      primaryContactPhone: supplier.primaryContactPhone ?? "",
      taxId: supplier.taxId ?? "",
      accountNumber: supplier.accountNumber ?? "",
      addressLine1: supplier.addressLine1 ?? "",
      addressLine2: supplier.addressLine2 ?? "",
      addressCity: supplier.addressCity ?? "",
      addressRegion: supplier.addressRegion ?? "",
      addressPostalCode: supplier.addressPostalCode ?? "",
      websiteUrl: supplier.websiteUrl ?? "",
      notes: supplier.notes ?? "",
    },
  });

  function onSubmit(data: EditSupplierParsed) {
    setError(null);
    updateSupplier.mutate(
      { id: supplier.id, ...data },
      {
        onSuccess: () => {
          toast.success("Supplier updated.");
          router.push(`/suppliers/${supplier.id}`);
        },
        onError: (e: Error) => setError(e.message),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
    <Card className="w-full">
      <CardContent className="pt-6">
        <form id="form-edit-supplier" onSubmit={form.handleSubmit(onSubmit)}>
          {error ? (
            <FormErrorAlert title="We couldn't save your changes.">
              {error}
            </FormErrorAlert>
          ) : null}

          <FieldGroup>
            <FormSection title="Identity">
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

              <div className="grid gap-6 @md/field-group:grid-cols-2">
                <Controller
                  name="accountNumber"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-edit-supplier-account-number">
                        Account number
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-edit-supplier-account-number"
                        value={field.value ?? ""}
                        placeholder="Your buyer-account ID with this supplier"
                      />
                      <FieldDescription>
                        Often printed on the supplier&apos;s invoices.
                      </FieldDescription>
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />

                <Controller
                  name="websiteUrl"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-edit-supplier-website">
                        Website
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-edit-supplier-website"
                        value={field.value ?? ""}
                        inputMode="url"
                        placeholder="abcmeat.com"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
              </div>
            </FormSection>

            <FormSection title="Primary contact">
              <Controller
                name="primaryContactName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-edit-supplier-contact-name">
                      Contact name
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-edit-supplier-contact-name"
                      value={field.value ?? ""}
                      placeholder="e.g. Jamie Rivera"
                      autoComplete="name"
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <div className="grid gap-6 @md/field-group:grid-cols-2">
                <Controller
                  name="primaryContactEmail"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-edit-supplier-contact-email">
                        Email
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-edit-supplier-contact-email"
                        type="email"
                        inputMode="email"
                        value={field.value ?? ""}
                        placeholder="ap@abcmeat.com"
                        autoComplete="email"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />

                <Controller
                  name="primaryContactPhone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-edit-supplier-contact-phone">
                        Phone
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-edit-supplier-contact-phone"
                        type="tel"
                        inputMode="tel"
                        value={field.value ?? ""}
                        placeholder="(555) 123-4567"
                        autoComplete="tel"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              title="Remit-to address"
              description="Where you mail checks or returns. US only."
            >
              <Controller
                name="addressLine1"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-edit-supplier-address-line1">
                      Street address
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-edit-supplier-address-line1"
                      value={field.value ?? ""}
                      placeholder="123 Market St"
                      autoComplete="address-line1"
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <Controller
                name="addressLine2"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-edit-supplier-address-line2">
                      Suite / unit
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-edit-supplier-address-line2"
                      value={field.value ?? ""}
                      placeholder="Suite 400"
                      autoComplete="address-line2"
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <div className="grid gap-6 @md/field-group:grid-cols-[2fr_1fr_1fr]">
                <Controller
                  name="addressCity"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-edit-supplier-address-city">
                        City
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-edit-supplier-address-city"
                        value={field.value ?? ""}
                        autoComplete="address-level2"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />

                <Controller
                  name="addressRegion"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-edit-supplier-address-region">
                        State
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-edit-supplier-address-region"
                        value={field.value ?? ""}
                        placeholder="CA"
                        autoComplete="address-level1"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />

                <Controller
                  name="addressPostalCode"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-edit-supplier-address-postal">
                        ZIP
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-edit-supplier-address-postal"
                        value={field.value ?? ""}
                        inputMode="numeric"
                        placeholder="94103"
                        autoComplete="postal-code"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
              </div>
            </FormSection>

            <FormSection title="Payment & accounting">
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

              <Controller
                name="taxId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-edit-supplier-tax-id">
                      Tax ID (EIN)
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-edit-supplier-tax-id"
                      value={field.value ?? ""}
                      placeholder="12-3456789"
                      inputMode="numeric"
                    />
                    <FieldDescription>
                      US Employer Identification Number — required if you&apos;ll
                      issue this supplier a 1099-NEC at year end.
                    </FieldDescription>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            </FormSection>

            <FormSection title="Notes">
              <Controller
                name="notes"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-edit-supplier-notes" className="sr-only">
                      Internal notes
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="form-edit-supplier-notes"
                      value={field.value ?? ""}
                      rows={4}
                      placeholder="Anything else worth remembering about this supplier — delivery quirks, contact preferences, etc."
                    />
                    <FieldDescription>
                      Visible only to your workspace. Up to 4,000 characters.
                    </FieldDescription>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            </FormSection>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
    <FormActionFooter
      formId="form-edit-supplier"
      isPending={updateSupplier.isPending}
      onCancel={() => router.push(`/suppliers/${supplier.id}`)}
      pendingLabel="Saving…"
      submitLabel="Save changes"
      sticky
    />
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-xs text-subtle">{description}</p>
        ) : null}
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}
