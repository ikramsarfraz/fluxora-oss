"use server";

import {
  getUnitsOfMeasure,
  getUnitOfMeasureById,
  createUnitOfMeasure,
  updateUnitOfMeasure,
  deleteUnitOfMeasure,
} from "@/services/units-of-measure";

export async function getUnitsOfMeasureAction() {
  return await getUnitsOfMeasure();
}

export async function getUnitOfMeasureAction(id: string) {
  return await getUnitOfMeasureById(id);
}

export async function createUnitOfMeasureAction(input: {
  name: string;
  abbreviation?: string | null;
  notes?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Name is required.");
  return await createUnitOfMeasure({
    ...input,
    name: trimmed,
    abbreviation: input.abbreviation?.trim() || null,
    notes: input.notes?.trim() || null,
  });
}

export async function updateUnitOfMeasureAction(
  id: string,
  input: {
    name?: string;
    abbreviation?: string | null;
    notes?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  return await updateUnitOfMeasure(id, {
    ...input,
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.abbreviation !== undefined && {
      abbreviation: input.abbreviation?.trim() || null,
    }),
    ...(input.notes !== undefined && {
      notes: input.notes?.trim() || null,
    }),
  });
}

export async function deleteUnitOfMeasureAction(id: string) {
  return await deleteUnitOfMeasure(id);
}
