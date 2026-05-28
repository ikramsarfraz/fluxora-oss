import * as z from "zod";

import { SUPPORTED_CURRENCIES } from "@/lib/utils/currency";

const currencyCodes = SUPPORTED_CURRENCIES.map(c => c.code) as [
  string,
  ...string[],
];

/**
 * Form schema for the workspace currency & tax card (#232 / smoke-test
 * follow-up). The tax rate ships through the form in percent form
 * ("8.25") for human friendliness; the persisted column stores the
 * fraction (0.0825). Validation refuses negative, > 99.99, and
 * non-numeric values inline — replaces the old native-min/max behavior
 * which silently let -1 / 150 / "abc" through to the toast.
 */
export const currencyTaxFormSchema = z.object({
  baseCurrency: z.enum(currencyCodes, {
    message: "Pick a currency.",
  }),
  taxInclusive: z.boolean(),
  /**
   * Stored as a string so the input round-trips exactly what the user
   * typed (no trailing-zero coercion). Empty string → no default rate.
   */
  defaultTaxRatePercent: z
    .string()
    .trim()
    .refine(
      v => v === "" || Number.isFinite(Number(v)),
      "Tax rate must be a number.",
    )
    .refine(
      v => v === "" || Number(v) >= 0,
      "Tax rate can’t be negative.",
    )
    .refine(
      v => v === "" || Number(v) <= 99.99,
      "Tax rate must be 99.99% or lower.",
    ),
});

export type CurrencyTaxFormValues = z.infer<typeof currencyTaxFormSchema>;
