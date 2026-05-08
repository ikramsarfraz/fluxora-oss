import * as z from "zod";

export const addCategoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().optional(),
});

export type AddCategoryFormValues = z.infer<typeof addCategoryFormSchema>;
