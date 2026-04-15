import * as z from "zod";

export const signInFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;
