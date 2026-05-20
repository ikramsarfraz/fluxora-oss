"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { SubscriptionUpgradeMessage } from "@/modules/core/billing/components/subscription/subscription-upgrade-message";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCustomerInputSchema,
  type CreateCustomerInput,
} from "../validators/customer.schemas";
import {
  createCustomerAction,
  suggestInvoicePrefixAction,
  updateCustomerAction,
} from "@/modules/distribution/customers/actions";
import { NetTermsLegend } from "@/modules/shared/components/net-terms-legend";
import { US_STATES } from "@/lib/constants/us-states";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import {
  isLimitReachedMessage,
  stripSubscriptionEnforcementPrefix,
} from "@/lib/subscription-enforcement";
import type { CustomerDetail } from "../services/customers";

const emptyAddress = {
  addressType: "shipping" as const,
  street: "",
  city: "",
  state: "",
  zip: "",
  isDefault: false,
};

function buildDefaultCustomerForm(customer?: CustomerDetail): CreateCustomerInput {
  if (!customer) {
    return {
      name: "",
      abbreviation: "",
      email: "",
      phoneNumber: "",
      taxId: "",
      netDays: "",
      fuelSurchargeAmount: "",
      creditLimit: "",
      notes: "",
      addresses: [],
    };
  }

  return {
    name: customer.name,
    abbreviation: customer.abbreviation ?? "",
    email: customer.email ?? "",
    phoneNumber: customer.phoneNumber ?? "",
    taxId: customer.taxId ?? "",
    netDays: customer.netDays == null ? "" : String(customer.netDays),
    fuelSurchargeAmount: customer.fuelSurchargeAmount ?? "",
    creditLimit: customer.creditLimit ?? "",
    notes: customer.notes ?? "",
    addresses: customer.addresses.map(address => ({
      addressType: address.addressType,
      street: address.street,
      city: address.city ?? "",
      state: address.state ?? "",
      zip: address.zip ?? "",
      isDefault: address.isDefault ?? false,
    })),
  };
}

export function AddCustomerForm(props?: {
  mode?: "create" | "edit";
  customer?: CustomerDetail;
  /**
   * Stick the save/cancel bar to the viewport bottom. Pass `true` from
   * route pages so the actions stay reachable on long forms; leave off
   * inside modals where the dialog already manages footer placement.
   */
  stickyFooter?: boolean;
}) {
  const mode = props?.mode ?? "create";
  const customer = props?.customer;
  const stickyFooter = props?.stickyFooter ?? false;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const defaultValues = buildDefaultCustomerForm(customer);

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerInputSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  const [generatingPrefix, setGeneratingPrefix] = useState(false);

  async function handleGeneratePrefix() {
    const name = (form.getValues("name") ?? "").trim();
    if (!name) {
      form.setError("name", {
        type: "required",
        message: "Enter a customer name first, then we can generate a prefix.",
      });
      form.setFocus("name");
      return;
    }
    setGeneratingPrefix(true);
    try {
      const suggestion = await suggestInvoicePrefixAction(name, customer?.id);
      form.setValue("abbreviation", suggestion, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't suggest a prefix.",
      );
    } finally {
      setGeneratingPrefix(false);
    }
  }

  async function onSubmit(data: CreateCustomerInput) {
    setError(null);
    try {
      const result =
        mode === "edit" && customer
          ? await updateCustomerAction(customer.id, data)
          : await createCustomerAction(data);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      invalidateSetupChecklistQuery(queryClient);
      toast.success(mode === "edit" ? "Customer updated." : "Customer created.");
      router.push("/customers/" + result.id);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : mode === "edit"
            ? "Failed to update customer"
            : "Failed to add customer",
      );
    }
  }

  const isPending = form.formState.isSubmitting;

  const footer = (
    <FormActionFooter
      formId="form-add-customer"
      isPending={isPending}
      onCancel={() =>
        router.push(
          mode === "edit" && customer
            ? `/customers/${customer.id}`
            : "/customers",
        )
      }
      pendingLabel={mode === "edit" ? "Saving…" : "Creating…"}
      submitLabel={mode === "edit" ? "Save changes" : "Create customer"}
      sticky={stickyFooter}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <Card className="w-full">
        <CardContent className="pt-6">
          <form id="form-add-customer" onSubmit={form.handleSubmit(onSubmit)}>
            {error ? (
              <FormErrorAlert
                title={
                  mode === "edit"
                    ? "We couldn't save your changes."
                    : "We couldn't create the customer."
                }
              >
                {isLimitReachedMessage(error, "maxCustomers") ? (
                  <SubscriptionUpgradeMessage message="Your current plan has reached the customer limit." />
                ) : (
                  stripSubscriptionEnforcementPrefix(error)
                )}
              </FormErrorAlert>
            ) : null}

            <FieldGroup>
              <FormSection title="Identity">
                <div className="grid gap-6 @md/field-group:grid-cols-[2fr_1fr]">
                  <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="form-add-customer-name">
                          Customer name *
                        </FieldLabel>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          id="form-add-customer-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="e.g. Acme Meats Inc."
                          autoComplete="organization"
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
                        <FieldLabel htmlFor="form-add-customer-invoice-prefix">
                          Invoice prefix *
                        </FieldLabel>
                        <div className="flex items-stretch gap-2">
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            id="form-add-customer-invoice-prefix"
                            aria-invalid={fieldState.invalid}
                            placeholder="e.g. ACME"
                            maxLength={32}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGeneratePrefix}
                            disabled={generatingPrefix}
                            className="shrink-0"
                          >
                            {generatingPrefix ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="size-3.5" />
                            )}
                            Generate
                          </Button>
                        </div>
                        <FieldDescription>
                          Short code that prefixes invoice numbers (ACME-001).
                          Must be unique per workspace.
                        </FieldDescription>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title="Contact">
                <div className="grid gap-6 @md/field-group:grid-cols-2">
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="form-add-customer-email">
                          Email
                        </FieldLabel>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          id="form-add-customer-email"
                          type="email"
                          inputMode="email"
                          aria-invalid={fieldState.invalid}
                          placeholder="ap@acme.com"
                          autoComplete="email"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="phoneNumber"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="form-add-customer-phone">
                          Phone
                        </FieldLabel>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          id="form-add-customer-phone"
                          type="tel"
                          inputMode="tel"
                          aria-invalid={fieldState.invalid}
                          placeholder="(555) 123-4567"
                          autoComplete="tel"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title="Payment & accounting">
                <div className="grid gap-6 @md/field-group:grid-cols-2">
                  <Controller
                    name="netDays"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="form-add-customer-net-days">
                          Payment terms (net days)
                        </FieldLabel>
                        <Input
                          id="form-add-customer-net-days"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={365}
                          step={1}
                          placeholder="e.g. 30"
                          value={field.value == null ? "" : String(field.value)}
                          onChange={e => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldDescription>
                          Days until invoice is due. Blank = due on receipt.
                        </FieldDescription>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="fuelSurchargeAmount"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="form-add-customer-fuel">
                          Fuel surcharge ($)
                        </FieldLabel>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          id="form-add-customer-fuel"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          aria-invalid={fieldState.invalid}
                          placeholder="0.00"
                        />
                        <FieldDescription>
                          Flat add-on per order, when the order has &ldquo;Add
                          fuel surcharge&rdquo; ticked.
                        </FieldDescription>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>

                <NetTermsLegend />

                <Controller
                  name="creditLimit"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="@md/field-group:max-w-xs"
                    >
                      <FieldLabel htmlFor="form-add-customer-credit-limit">
                        Credit limit ($)
                      </FieldLabel>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        id="form-add-customer-credit-limit"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        aria-invalid={fieldState.invalid}
                        placeholder="0.00"
                      />
                      <FieldDescription>
                        Soft cap on open AR. Detail page flags when the
                        customer is over. Leave blank for no limit.
                      </FieldDescription>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="taxId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-add-customer-tax-id">
                        Tax ID (EIN)
                      </FieldLabel>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        id="form-add-customer-tax-id"
                        aria-invalid={fieldState.invalid}
                        placeholder="12-3456789"
                        inputMode="numeric"
                        maxLength={10}
                      />
                      <FieldDescription>
                        9-digit US EIN. Optional — required if you need to
                        include it on B2B invoices.
                      </FieldDescription>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FormSection>

              <FormSection
                title="Addresses"
                description="Shipping is what drivers route to; billing shows on invoices. The default one auto-fills new orders. US only."
              >
                {fields.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {fields.map((addressField, index) => (
                      <AddressFields
                        key={addressField.id}
                        index={index}
                        control={form.control}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-subtle">
                    No addresses yet. Add one if you ship to or invoice this customer.
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    append({
                      ...emptyAddress,
                      isDefault: fields.length === 0,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add address
                </Button>
              </FormSection>

              <FormSection title="Internal notes">
                <Controller
                  name="notes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel
                        htmlFor="form-add-customer-notes"
                        className="sr-only"
                      >
                        Internal notes
                      </FieldLabel>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        id="form-add-customer-notes"
                        rows={4}
                        placeholder="Anything worth remembering — delivery quirks, contact preferences, payment habits, etc."
                      />
                      <FieldDescription>
                        Visible only to your workspace. Up to 4,000 characters.
                      </FieldDescription>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FormSection>
            </FieldGroup>
          </form>
        </CardContent>
        {!stickyFooter ? footer : null}
      </Card>
      {stickyFooter ? footer : null}
    </div>
  );
}

function AddressFields({
  index,
  control,
  onRemove,
}: {
  index: number;
  control: ReturnType<typeof useForm<CreateCustomerInput>>["control"];
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-border-default p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Controller
            name={`addresses.${index}.addressType`}
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? "shipping"}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id={`addresses-${index}-type`}
                  className="h-8 w-36 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <Controller
            name={`addresses.${index}.isDefault`}
            control={control}
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-subtle">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={e => field.onChange(e.target.checked)}
                  className="size-3.5 rounded border-border-default"
                />
                Default
              </label>
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove address ${index + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <Controller
          name={`addresses.${index}.street`}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`addresses-${index}-street`}>
                Street *
              </FieldLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                id={`addresses-${index}-street`}
                aria-invalid={fieldState.invalid}
                placeholder="123 Main St"
                autoComplete="street-address"
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <div className="grid gap-4 @md/field-group:grid-cols-[2fr_1fr_1fr]">
          <Controller
            name={`addresses.${index}.city`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`addresses-${index}-city`}>
                  City *
                </FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={`addresses-${index}-city`}
                  aria-invalid={fieldState.invalid}
                  placeholder="San Francisco"
                  autoComplete="address-level2"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name={`addresses.${index}.state`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`addresses-${index}-state`}>
                  State *
                </FieldLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id={`addresses-${index}-state`}
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(s => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name={`addresses.${index}.zip`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`addresses-${index}-zip`}>
                  ZIP *
                </FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={`addresses-${index}-zip`}
                  aria-invalid={fieldState.invalid}
                  placeholder="94103"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      </div>
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
