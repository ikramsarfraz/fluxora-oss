import { z } from "zod";
import { addressTypeEnum } from "@/db/schema";
import { US_STATE_CODES } from "@/lib/constants/us-states";

const nullableOptionalString = z.string().trim().nullable().optional();

/**
 * Email — empty string and null both coerce to `null`. We don't reject unset
 * (the field is fully optional), but if a non-empty value is given it must
 * look like an email address.
 */
const optionalEmail = z
  .union([z.literal(""), z.string().trim().email("Invalid email address")])
  .nullable()
  .optional()
  .transform(v => (v === "" || v == null ? null : v.toLowerCase()));

/**
 * US EIN — "12-3456789" or bare 9 digits. Stored verbatim; normalization
 * (hyphen insertion) happens server-side if we need a canonical form.
 */
const optionalTaxId = z
  .union([z.literal(""), z.string().trim().regex(/^\d{2}-?\d{7}$/, "Tax ID must be a 9-digit US EIN (e.g. 12-3456789)")])
  .nullable()
  .optional()
  .transform(v => (v === "" || v == null ? null : v));

/**
 * Net payment terms in days. Stored as an integer; UI accepts a numeric string
 * for parity with how other numeric inputs (fuel surcharge) are handled.
 */
const optionalNetDays = z
  .union([z.literal(""), z.coerce.number().int().min(0, "Must be 0 or more days").max(365, "Must be 365 days or less")])
  .nullable()
  .optional()
  .transform(v => (v === "" || v == null ? null : Number(v)));

export const customerAddressInputSchema = z.object({
  addressType: z.enum(addressTypeEnum.enumValues).default("shipping"),
  street: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      value =>
        US_STATE_CODES.includes(value as (typeof US_STATE_CODES)[number]),
      { message: "State is required" },
    ),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "ZIP code must be 5 digits"),
  isDefault: z.boolean().optional(),
});

export const createCustomerInputSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  abbreviation: z
    .string()
    .trim()
    .min(1, "Abbreviation is required")
    .max(32, "Abbreviation must be 32 characters or less")
    .toUpperCase(),
  email: optionalEmail,
  phoneNumber: nullableOptionalString,
  taxId: optionalTaxId,
  netDays: optionalNetDays,
  fuelSurchargeAmount: nullableOptionalString,
  addresses: z.array(customerAddressInputSchema).optional(),
});

export type CreateCustomerInput = z.input<typeof createCustomerInputSchema>;
