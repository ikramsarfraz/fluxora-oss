import { eq } from "drizzle-orm";
import { db } from "@/db";
import { unitsOfMeasure } from "@/db/schema";

export async function getUnitsOfMeasure() {
  const result = await db.query.unitsOfMeasure.findMany({
    orderBy: (uom, { asc }) => [asc(uom.sortOrder), asc(uom.name)],
  });

  return result;
}

export async function getUnitOfMeasureById(id: number) {
  const result = await db.query.unitsOfMeasure.findFirst({
    where: eq(unitsOfMeasure.id, id),
  });

  return result ?? null;
}

export async function createUnitOfMeasure(input: {
  name: string;
  abbreviation?: string | null;
  notes?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const [unit] = await db
    .insert(unitsOfMeasure)
    .values({
      name: input.name,
      abbreviation: input.abbreviation ?? null,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning();

  return unit;
}

export async function updateUnitOfMeasure(
  id: number,
  input: {
    name?: string;
    abbreviation?: string | null;
    notes?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  const [unit] = await db
    .update(unitsOfMeasure)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.abbreviation !== undefined && { abbreviation: input.abbreviation }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    })
    .where(eq(unitsOfMeasure.id, id))
    .returning();

  return unit;
}

export async function deleteUnitOfMeasure(id: number) {
  await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.id, id));
}

/** Row shape returned by `getUnitsOfMeasure()` (for client `import type` only). */
export type UnitOfMeasureListItem = Awaited<ReturnType<typeof getUnitsOfMeasure>>[number];
