import * as z from "zod";

export const onboardingFormSchema = z.object({
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
    ),
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;
