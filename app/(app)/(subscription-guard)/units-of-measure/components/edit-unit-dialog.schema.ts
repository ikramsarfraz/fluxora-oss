import * as z from "zod";

import { addUnitFormSchema } from "./add-unit-form.schema";

export const editUnitFormSchema = addUnitFormSchema.extend({
  isActive: z.boolean(),
});

export type EditUnitFormValues = z.infer<typeof editUnitFormSchema>;
