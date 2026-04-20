import * as z from "zod";

export const addUnitFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  abbreviation: z
    .string()
    .trim()
    .max(16, "Abbreviation must be at most 16 characters."),
  notes: z.string().trim(),
  sortOrder: z.string().refine(
    s => s.trim() === "" || /^-?\d+$/.test(s.trim()),
    "Sort order must be a whole number.",
  ),
});

export type AddUnitFormValues = z.infer<typeof addUnitFormSchema>;
