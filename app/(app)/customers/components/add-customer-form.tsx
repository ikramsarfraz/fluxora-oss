"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, endpoints, type Customer } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const createCustomerSchema = z.object({
  name: z
    .string()
    .transform(s => s.trim())
    .pipe(z.string().min(1, "Please enter a customer name.")),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  phoneNumber: z.string(),
});

type CreateCustomerValues = z.infer<typeof createCustomerSchema>;

export function AddCustomerForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const createForm = useForm<CreateCustomerValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      name: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      phoneNumber: "",
    },
  });

  const createCustomer = useMutation({
    mutationFn: (body: {
      name: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      phone_number?: string;
    }) => api.post<Customer>(endpoints.customers.create(), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      createForm.reset();
      setError(null);
      toast.success("Customer added");
      router.push("/customers");
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(data: CreateCustomerValues) {
    setError(null);
    createCustomer.mutate({
      name: data.name,
      street: data.street.trim() || undefined,
      city: data.city.trim() || undefined,
      state: data.state.trim() || undefined,
      zip: data.zip.trim() || undefined,
      phone_number: data.phoneNumber.trim() || undefined,
    });
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form
          id="form-add-customer"
          onSubmit={createForm.handleSubmit(onSubmit)}
        >
          <FieldGroup>
            <Controller
              name="name"
              control={createForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-customer-name">
                    Customer name *
                  </FieldLabel>
                  <Input
                    {...field}
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
              name="street"
              control={createForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-customer-street">
                    Street
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-customer-street"
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
            <div className="flex flex-wrap gap-4">
              <Controller
                name="city"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="min-w-40 max-w-50 flex-1"
                  >
                    <FieldLabel htmlFor="form-add-customer-city">
                      City
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-add-customer-city"
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
                name="state"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="max-w-30"
                  >
                    <FieldLabel htmlFor="form-add-customer-state">
                      State
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-add-customer-state"
                      aria-invalid={fieldState.invalid}
                      placeholder="State"
                      autoComplete="address-level1"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="zip"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="max-w-25"
                  >
                    <FieldLabel htmlFor="form-add-customer-zip">ZIP</FieldLabel>
                    <Input
                      {...field}
                      id="form-add-customer-zip"
                      aria-invalid={fieldState.invalid}
                      placeholder="ZIP"
                      autoComplete="postal-code"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
            <Controller
              name="phoneNumber"
              control={createForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-customer-phone">
                    Phone number
                  </FieldLabel>
                  <Input
                    {...field}
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
            {error && (
              <div className="text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2 border-t pt-6">
        <Field orientation="horizontal" className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => createForm.reset()}
          >
            Reset
          </Button>
          <Button
            type="submit"
            form="form-add-customer"
            disabled={createCustomer.isPending}
          >
            {createCustomer.isPending ? "Adding…" : "Add customer"}
          </Button>
        </Field>
      </CardFooter>
    </Card>
  );
}
