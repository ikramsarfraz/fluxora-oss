"use client";

import Link from "next/link";
import { Controller, type Control } from "react-hook-form";
import { Building2, MapPin, Phone, Receipt, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useCustomers } from "@/hooks/use-customers";
import type { CustomerListItem } from "@/services/customers";

import type { NewOrderFormValues } from "./new-order-form.schema";

interface NewOrderCustomerCardProps {
  control: Control<NewOrderFormValues>;
}

export function NewOrderCustomerCard({ control }: NewOrderCustomerCardProps) {
  const { data: customers, isLoading } = useCustomers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
        <CardDescription>
          Select the customer to bill and ship this order to.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          control={control}
          name="customerId"
          render={({ field, fieldState }) => {
            const selected =
              customers?.find(c => c.id === field.value) ?? null;

            return (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Customer *</FieldLabel>
                  <Combobox
                    items={customers ?? []}
                    itemToStringValue={(c: CustomerListItem) => c.name}
                    value={selected}
                    onValueChange={(c: CustomerListItem | null) =>
                      field.onChange(c?.id ?? "")
                    }
                  >
                    <ComboboxTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          aria-invalid={fieldState.invalid}
                          className="w-full justify-between font-normal"
                          disabled={isLoading}
                        >
                          <ComboboxValue>
                            {selected?.name ??
                              (isLoading ? "Loading…" : "Select customer")}
                          </ComboboxValue>
                        </Button>
                      }
                    />
                    <ComboboxContent>
                      <ComboboxInput
                        showTrigger={false}
                        placeholder="Search customers…"
                      />
                      <ComboboxEmpty>No customers found.</ComboboxEmpty>
                      <ComboboxList>
                        {(c: CustomerListItem) => (
                          <ComboboxItem key={c.id} value={c}>
                            <div className="flex flex-col">
                              <span>{c.name}</span>
                              {c.phoneNumber ? (
                                <span className="text-xs text-muted-foreground">
                                  {c.phoneNumber}
                                </span>
                              ) : null}
                            </div>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>

                <CustomerDetailsPanel customer={selected} />
              </div>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

function CustomerDetailsPanel({
  customer,
}: {
  customer: CustomerListItem | null;
}) {
  if (!customer) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        Customer details will appear here once selected.
      </div>
    );
  }

  const defaultAddress =
    customer.addresses?.find(a => a.isDefault) ?? customer.addresses?.[0];

  const fuelSurcharge = customer.fuelSurchargeAmount
    ? Number(customer.fuelSurchargeAmount)
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {customer.name}
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link href={`/customers/${customer.id}`}>View customer</Link>
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <DetailRow
          icon={Phone}
          label="Phone"
          value={customer.phoneNumber ?? "—"}
        />
        <DetailRow
          icon={Receipt}
          label="Invoice prefix"
          value={customer.invoicePrefix ?? "—"}
          mono={!!customer.invoicePrefix}
        />
        <DetailRow
          icon={Truck}
          label="Fuel surcharge"
          value={
            fuelSurcharge !== null && fuelSurcharge > 0
              ? `$${fuelSurcharge.toFixed(2)}`
              : "None"
          }
        />
        <DetailRow
          icon={MapPin}
          label="Ship to"
          value={
            defaultAddress
              ? [
                  defaultAddress.street,
                  [
                    defaultAddress.city,
                    defaultAddress.state,
                    defaultAddress.zip,
                  ]
                    .filter(Boolean)
                    .join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "No address on file"
          }
        />
      </dl>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex flex-col">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className={mono ? "font-mono text-sm" : "text-sm"}>{value}</dd>
      </div>
    </div>
  );
}
