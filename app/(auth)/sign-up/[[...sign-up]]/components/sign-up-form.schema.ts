import * as z from "zod";

export const signUpFormSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name."),
  lastName: z.string().trim().min(1, "Please enter your last name."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email.")
    .email("Enter a valid email address."),
});

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;
