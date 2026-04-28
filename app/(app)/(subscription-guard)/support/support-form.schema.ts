import { z } from "zod";

export const supportFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  tenantName: z.string().trim().min(1, "Company is required."),
  issueType: z.enum(["bug", "question", "feature_request", "workflow_issue"]),
  priority: z.enum(["low", "medium", "high"]),
  subject: z.string().trim().min(1, "Subject is required.").max(255),
  message: z
    .string()
    .trim()
    .min(10, "Add a few details so support can understand the issue."),
  pageUrl: z.string().trim().optional(),
});

export type SupportFormValues = z.input<typeof supportFormSchema>;
export type SupportFormParsed = z.output<typeof supportFormSchema>;
