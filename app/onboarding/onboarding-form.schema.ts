import * as z from "zod";

import { isReservedTenantSlug } from "@/lib/tenant-slug-policy";

export const onboardingFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Please enter your first name."),
  lastName: z
    .string()
    .trim()
    .min(1, "Please enter your last name."),
  tenantName: z
    .string()
    .trim()
    .min(1, "Please enter your workspace or company name."),
  tenantSlug: z
    .string()
    .trim()
    .min(1, "Please choose a workspace URL.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens only.",
    )
    .refine(value => !isReservedTenantSlug(value), {
      message: "That workspace URL is reserved. Please choose another.",
    }),
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;
