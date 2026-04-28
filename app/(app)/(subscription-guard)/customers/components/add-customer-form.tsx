"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Field,
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
import {
  createCustomerInputSchema,
  type CreateCustomerInput,
} from "../customer.schemas";
import { createCustomerAction } from "@/actions/customers";
import { US_STATES } from "@/lib/constants/us-states";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";

const emptyAddress = {
  addressType: "shipping" as const,
  street: "",
  city: "",
  state: "",
  zip: "",
  isDefault: false,
};

function isCustomerLimitError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("allows up to") && normalized.includes("customers");
}

export function AddCustomerForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerInputSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      fuelSurchargeAmount: "",
      invoicePrefix: "",
      addresses: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  async function onSubmit(data: CreateCustomerInput) {
    setError(null);
    try {
      const customer = await createCustomerAction(data);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      invalidateSetupChecklistQuery(queryClient);
      form.reset();
      toast.success("Customer added");
      router.push("/customers/" + customer.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add customer");
    }
  }

  const isPending = form.formState.isSubmitting;

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-customer" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {/* Customer name */}
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

            {/* Phone */}
            <Controller
              name="phoneNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-customer-phone">
                    Phone number
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="form-add-customer-phone"
                    type="tel"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. (555) 123-4567"
                    autoComplete="tel"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Fuel surcharge */}
            <Controller
              name="fuelSurchargeAmount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-customer-fuel">
                    Fuel surcharge
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="form-add-customer-fuel"
                    type="number"
                    min="0"
                    step="0.01"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. 0.05"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Addresses */}
            {fields.length > 0 && (
              <div className="flex flex-col gap-6">
                {fields.map((addressField, index) => (
                  <div
                    key={addressField.id}
                    className="rounded-md border p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Address {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        aria-label={`Remove address ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Address type */}
                    <Controller
                      name={`addresses.${index}.addressType`}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={`addresses-${index}-type`}>
                            Type
                          </FieldLabel>
                          <Select
                            value={field.value ?? "shipping"}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id={`addresses-${index}-type`}
                              aria-invalid={fieldState.invalid}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="shipping">Shipping</SelectItem>
                              <SelectItem value="billing">Billing</SelectItem>
                              <SelectItem value="warehouse">
                                Warehouse
                              </SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    {/* Street */}
                    <Controller
                      name={`addresses.${index}.street`}
                      control={form.control}
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
                            placeholder="Street address"
                            autoComplete="street-address"
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    {/* City / State / ZIP */}
                    <div className="flex flex-wrap gap-3">
                      <Controller
                        name={`addresses.${index}.city`}
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field
                            data-invalid={fieldState.invalid}
                            className="max-w-60 flex-1"
                          >
                            <FieldLabel htmlFor={`addresses-${index}-city`}>
                              City *
                            </FieldLabel>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              id={`addresses-${index}-city`}
                              aria-invalid={fieldState.invalid}
                              placeholder="City"
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
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field
                            data-invalid={fieldState.invalid}
                            className="max-w-40"
                          >
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
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field
                            data-invalid={fieldState.invalid}
                            className="max-w-28"
                          >
                            <FieldLabel htmlFor={`addresses-${index}-zip`}>
                              ZIP *
                            </FieldLabel>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              id={`addresses-${index}-zip`}
                              aria-invalid={fieldState.invalid}
                              placeholder="12345"
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
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                append({
                  ...emptyAddress,
                  isDefault: fields.length === 0,
                })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add address
            </Button>

            {error && (
              <div className="text-sm text-destructive" role="alert">
                {isCustomerLimitError(error) ? (
                  <div className="space-y-2">
                    <p>Your current plan has reached the customer limit.</p>
                    <Link
                      href="/account/billing#billing-plans"
                      className="font-medium underline underline-offset-4"
                    >
                      Upgrade plan
                    </Link>
                  </div>
                ) : (
                  error
                )}
              </div>
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/customers")}
        >
          Cancel
        </Button>
        <Button type="submit" form="form-add-customer" disabled={isPending}>
          {isPending ? "Adding..." : "Add Customer"}
        </Button>
      </CardFooter>
    </Card>
  );
}
