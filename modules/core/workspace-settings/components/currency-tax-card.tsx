"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  formatTaxRatePercent,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "@/lib/utils/currency";

import { updateCurrencyTaxSettingsAction } from "@/modules/core/workspace-settings/actions";

import {
  currencyTaxFormSchema,
  type CurrencyTaxFormValues,
} from "./currency-tax-card.schema";

/**
 * Workspace-admin card for the tenant's display currency + tax pricing
 * preferences (#232 phase 1). Now react-hook-form + zod — replaces the
 * native input min/max that silently let -1 / 150 / "abc" submit
 * (smoke test #1 follow-up). Errors render inline under the field via
 * the codebase's `<FieldError>` primitive, matching every other form.
 */
export function CurrencyTaxCard({
  currentBaseCurrency,
  currentTaxInclusive,
  currentDefaultTaxRate,
}: {
  currentBaseCurrency: CurrencyCode;
  currentTaxInclusive: boolean;
  /** Fraction string from the DB (e.g. "0.0825"), or null. */
  currentDefaultTaxRate: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const form = useForm<CurrencyTaxFormValues>({
    resolver: zodResolver(currencyTaxFormSchema),
    defaultValues: {
      baseCurrency: currentBaseCurrency,
      taxInclusive: currentTaxInclusive,
      defaultTaxRatePercent: formatTaxRatePercent(currentDefaultTaxRate),
    },
    mode: "onBlur",
  });

  function onSubmit(values: CurrencyTaxFormValues) {
    // Schema guarantees: numeric string in [0, 99.99] OR empty.
    // Empty → null in the DB (no default rate).
    const trimmed = values.defaultTaxRatePercent.trim();
    const fractionString =
      trimmed.length === 0 ? null : (Number(trimmed) / 100).toFixed(4);

    startTransition(async () => {
      try {
        await updateCurrencyTaxSettingsAction({
          baseCurrency: values.baseCurrency as CurrencyCode,
          taxInclusive: values.taxInclusive,
          defaultTaxRate: fractionString,
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.settings,
        });
        toast.success("Currency and tax settings saved.");
        // Re-baseline the form so a subsequent unchanged submit doesn't
        // refire the action with stale values.
        form.reset(values);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save settings.",
        );
      }
    });
  }

  return (
    <Card>
      <form
        id="form-currency-tax"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <CardHeader>
          <CardTitle className="text-base">Currency & tax</CardTitle>
          <CardDescription>
            How money is displayed in this workspace, and the default tax
            rate suggested on new invoices. Persisted amounts stay as
            cents — switching currency only changes what the user sees.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Controller
            name="baseCurrency"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="currency-tax-currency">
                  Base currency
                </FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="currency-tax-currency"
                    aria-invalid={fieldState.invalid}
                    className="w-64"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Existing amounts are not converted — this is a display
                  change only.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="defaultTaxRatePercent"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="currency-tax-default-rate">
                  Default tax rate (%)
                </FieldLabel>
                {/*
                  type="text" + inputMode="decimal" deliberately —
                  type="number" gives the browser license to silently
                  clear typed-but-out-of-range values on submit, which
                  is what hid the -1 / 150 cases from the user before.
                  zod is now the single source of truth for validity.
                */}
                <Input
                  {...field}
                  id="currency-tax-default-rate"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 8.25"
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  className="w-32 tabular-nums"
                />
                <FieldDescription>
                  Leave blank for no default — each invoice can still
                  specify its own rate. Allowed range: 0 to 99.99.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="taxInclusive"
            control={form.control}
            render={({ field }) => (
              <FieldGroup>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="currency-tax-inclusive"
                    checked={field.value}
                    onCheckedChange={value =>
                      field.onChange(value === true)
                    }
                    disabled={isPending}
                    className="mt-1"
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel
                      htmlFor="currency-tax-inclusive"
                      className="text-sm font-medium"
                    >
                      Prices include tax
                    </FieldLabel>
                    <FieldDescription>
                      When on, line item prices already include the tax
                      component. When off, tax is added on top at the
                      total.
                    </FieldDescription>
                  </div>
                </div>
              </FieldGroup>
            )}
          />
        </CardContent>
        <CardFooter>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
