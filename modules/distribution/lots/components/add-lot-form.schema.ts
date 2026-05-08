import * as z from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const addLotFormSchema = z
  .object({
    lotNumber: z.string().trim().min(1, "Lot number is required."),
    supplierId: z.string().uuid("Supplier is required."),
    receiveDate: z
      .string()
      .trim()
      .regex(isoDateRegex, "Receive date is required."),
    expirationDate: z
      .string()
      .trim()
      .regex(isoDateRegex, "Expiration date is required."),
  })
  .refine(data => data.expirationDate >= data.receiveDate, {
    path: ["expirationDate"],
    message: "Expiration date must be on or after the receive date.",
  });

export type AddLotFormValues = z.infer<typeof addLotFormSchema>;
