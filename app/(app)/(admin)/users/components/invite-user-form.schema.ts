import * as z from "zod";

const roleEnum = z.enum(["admin", "sales", "warehouse", "accounting"]);

export const inviteUserFormSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter a full name."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter an email.")
    .email("Enter a valid email address."),
  role: roleEnum,
});

export type InviteUserFormValues = z.infer<typeof inviteUserFormSchema>;
