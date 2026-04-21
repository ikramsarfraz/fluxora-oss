"use client";

import { useMemo } from "react";
import { Controller, useWatch, type Control } from "react-hook-form";
import { Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCustomers } from "@/hooks/use-customers";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/currency";

import type { NewOrderFormValues } from "./new-order-form.schema";

interface NewOrderSummaryCardProps {
  control: Control<NewOrderFormValues>;
}

export function NewOrderSummaryCard({ control }: NewOrderSummaryCardProps) {
  const { data: customers } = useCustomers();
  const customerId = useWatch({ control, name: "customerId" });
  const lines = useWatch({ control, name: "lines" });
  const addFuelSurcharge = useWatch({ control, name: "addFuelSurcharge" });
  const discountInput = useWatch({ control, name: "discountAmount" });

  const customer = useMemo(
    () => customers?.find(c => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const subtotal = useMemo(() => {
    let total = 0;
    for (const line of lines ?? []) {
      const cases = Number(line.expectedCases);
      const price = Number(line.pricePerLb);
      const estLbs = Number(line.estLbsPerCase);
      if (
        Number.isFinite(cases) &&
        Number.isFinite(price) &&
        Number.isFinite(estLbs) &&
        cases > 0 &&
        price > 0 &&
        estLbs > 0
      ) {
        total += cases * estLbs * price;
      }
    }
    return total;
  }, [lines]);

  const fuelSurcharge = useMemo(() => {
    if (!addFuelSurcharge) return 0;
    const raw = customer?.fuelSurchargeAmount;
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [addFuelSurcharge, customer]);

  const discount = useMemo(() => {
    const n = Number(discountInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [discountInput]);

  const hasEstimates = (lines ?? []).some(
    l =>
      Number(l.expectedCases) > 0 &&
      Number(l.pricePerLb) > 0 &&
      Number(l.estLbsPerCase) > 0,
  );

  const total = Math.max(0, subtotal + fuelSurcharge - discount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial summary</CardTitle>
        <CardDescription>
          Estimated totals. Final amounts will be set at fulfillment when
          catch-weights are captured.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Controller
          control={control}
          name="addFuelSurcharge"
          render={({ field }) => (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={field.value}
                onCheckedChange={checked =>
                  field.onChange(checked === true)
                }
              />
              <span>
                Apply customer fuel surcharge
                {customer?.fuelSurchargeAmount ? (
                  <span className="ml-1 text-muted-foreground">
                    ({formatMoney(customer.fuelSurchargeAmount)})
                  </span>
                ) : null}
              </span>
            </label>
          )}
        />

        <Controller
          control={control}
          name="discountAmount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-order-discount">
                Discount (optional)
              </FieldLabel>
              <Input
                id="new-order-discount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <span className="text-xs text-destructive">
                  {fieldState.error?.message}
                </span>
              ) : null}
            </Field>
          )}
        />

        <Separator />

        <dl className="flex flex-col gap-1.5 text-sm tabular-nums">
          <SummaryRow label="Subtotal" value={subtotal} muted={!hasEstimates} />
          <SummaryRow
            label="Fuel surcharge"
            value={fuelSurcharge}
            muted={fuelSurcharge === 0}
          />
          <SummaryRow
            label="Discount"
            value={discount > 0 ? -discount : 0}
            muted={discount === 0}
          />
          <Separator className="my-1" />
          <SummaryRow
            label="Estimated total"
            value={total}
            bold
            muted={!hasEstimates && total === 0}
          />
        </dl>

        {!hasEstimates && (lines?.length ?? 0) > 0 ? (
          <p className="flex items-start gap-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Fill in Est. lbs/case on each line to see an estimated total before
            fulfillment.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        bold && "text-base font-semibold text-foreground",
        muted && !bold && "text-muted-foreground",
      )}
    >
      <dt>{label}</dt>
      <dd>{formatMoney(value)}</dd>
    </div>
  );
}
