import { z } from "zod";
import { addressTypeEnum } from "@/db/schema";
import { US_STATE_CODES } from "@/lib/constants/us-states";

const nullableOptionalString = z.string().trim().nullable().optional();

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
  phoneNumber: nullableOptionalString,
  fuelSurchargeAmount: nullableOptionalString,
  invoicePrefix: nullableOptionalString,
  addresses: z.array(customerAddressInputSchema).optional(),
});

export type CreateCustomerInput = z.input<typeof createCustomerInputSchema>;
