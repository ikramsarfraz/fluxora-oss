"use client";

import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatTaxRatePercent,
  parseTaxRatePercent,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "@/lib/utils/currency";

import { updateCurrencyTaxSettingsAction } from "@/modules/core/workspace-settings/actions";

/**
 * Workspace-admin card for the tenant's display currency + tax pricing
 * preferences (#232 phase 1). Ships configuration only — actual tax-line
 * modeling on invoices/bills is phase 2.
 *
 * The default-tax-rate field accepts percent form (8.25) and the
 * formatter pair in lib/utils/currency.ts handles the fraction
 * round-trip (stores 0.0825 in the DB). Empty input clears the default
 * so the column goes back to NULL — that "no default" signal is what a
 * jurisdiction-by-jurisdiction tenant uses when they don't want a
 * blanket rate applied.
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
  const [currency, setCurrency] = useState<CurrencyCode>(currentBaseCurrency);
  const [taxInclusive, setTaxInclusive] = useState<boolean>(
    currentTaxInclusive,
  );
  // Stored as the percent-form draft so what the user sees is what
  // they typed. Converted to a fraction on submit.
  const [taxRateDraft, setTaxRateDraft] = useState<string>(
    formatTaxRatePercent(currentDefaultTaxRate),
  );
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let parsedRate: string | null;
    try {
      parsedRate = parseTaxRatePercent(taxRateDraft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid tax rate.");
      return;
    }
    startTransition(async () => {
      try {
        await updateCurrencyTaxSettingsAction({
          baseCurrency: currency,
          taxInclusive,
          defaultTaxRate: parsedRate,
        });
        // Server action revalidates RSC paths; the client also needs to
        // refresh the tenant-settings query so already-mounted client
        // components (e.g. invoice detail) re-render with the new
        // currency without a page reload.
        await queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.settings,
        });
        toast.success("Currency and tax settings saved.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save settings.",
        );
      }
    });
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle className="text-base">Currency & tax</CardTitle>
          <CardDescription>
            How money is displayed in this workspace, and the default tax
            rate suggested on new invoices. Persisted amounts stay as
            cents — switching currency only changes what the user sees.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency-tax-currency" className="text-[11px] font-medium text-muted-foreground">
              Base currency
            </Label>
            <Select
              value={currency}
              onValueChange={value => setCurrency(value as CurrencyCode)}
              disabled={isPending}
            >
              <SelectTrigger id="currency-tax-currency" className="w-64">
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
            <p className="text-[12px] text-muted-foreground">
              Existing amounts are not converted — this is a display change only.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency-tax-default-rate" className="text-[11px] font-medium text-muted-foreground">
              Default tax rate (%)
            </Label>
            <div className="flex items-end gap-3">
              <Input
                id="currency-tax-default-rate"
                type="number"
                inputMode="decimal"
                min={0}
                max={99.99}
                step="0.01"
                placeholder="e.g. 8.25"
                value={taxRateDraft}
                onChange={e => setTaxRateDraft(e.target.value)}
                disabled={isPending}
                className="w-32 tabular-nums"
              />
              <p className="pb-2 text-[12px] leading-[1.5] text-muted-foreground">
                Leave blank for no default — each invoice can still
                specify its own rate.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="currency-tax-inclusive"
              checked={taxInclusive}
              onCheckedChange={value => setTaxInclusive(value === true)}
              disabled={isPending}
              className="mt-1"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="currency-tax-inclusive" className="text-sm font-medium">
                Prices include tax
              </Label>
              <p className="text-[12px] text-muted-foreground">
                When on, line item prices already include the tax
                component. When off, tax is added on top at the total.
              </p>
            </div>
          </div>
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
