import { z } from "zod";

export const customerAddressInputSchema = z.object({
  addressType: z
    .enum(["billing", "shipping", "warehouse", "other"])
    .default("shipping"),
  street: z.string().min(1).max(255),
  city: z.string().max(128).optional(),
  state: z.string().max(64).optional(),
  zip: z.string().max(32).optional(),
  isDefault: z.boolean().optional(),
});

export const createCustomerInputSchema = z.object({
  name: z.string().min(1).max(255),
  phoneNumber: z.string().max(64).optional(),
  fuelSurchargeAmount: z.string().optional(),
  invoicePrefix: z.string().max(32).optional(),
  address: customerAddressInputSchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
