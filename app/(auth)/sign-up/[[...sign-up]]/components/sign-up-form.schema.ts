import * as z from "zod";

export const signUpFormSchema = z
  .object({
    accountType: z.enum(["business", "solo"]),
    name: z.string().trim().min(1, "Please enter your name."),
    email: z
      .string()
      .trim()
      .min(1, "Please enter your email.")
      .email("Enter a valid email address."),
    tenantName: z.string().trim().optional(),
    tenantSlug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and hyphens only.",
      )
      .optional()
      .or(z.literal("")),
    companyName: z.string().trim().optional(),
    industry: z.string().trim().optional(),
    companySize: z.string().trim().optional(),
    countryRegion: z.string().trim().optional(),
    currency: z.string().trim().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long."),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === "business") {
      if (!data.tenantName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter your company or workspace name.",
          path: ["tenantName"],
        });
      }

      if (!data.tenantSlug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please choose a workspace slug.",
          path: ["tenantSlug"],
        });
      }
    }
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;
