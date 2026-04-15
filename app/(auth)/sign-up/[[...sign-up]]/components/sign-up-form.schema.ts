import * as z from "zod";

export const signUpFormSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter your name."),
    email: z
      .string()
      .trim()
      .min(1, "Please enter your email.")
      .email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long."),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;
