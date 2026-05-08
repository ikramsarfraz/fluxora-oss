"use server";

import {
  createUnitOfMeasureAction as createUnitOfMeasureActionImpl,
  deleteUnitOfMeasureAction as deleteUnitOfMeasureActionImpl,
  getUnitOfMeasureAction as getUnitOfMeasureActionImpl,
  getUnitsOfMeasureAction as getUnitsOfMeasureActionImpl,
  updateUnitOfMeasureAction as updateUnitOfMeasureActionImpl,
} from "@/modules/distribution/units-of-measure/actions";

export async function getUnitsOfMeasureAction() {
  return getUnitsOfMeasureActionImpl();
}

export async function getUnitOfMeasureAction(
  ...args: Parameters<typeof getUnitOfMeasureActionImpl>
) {
  return getUnitOfMeasureActionImpl(...args);
}

export async function createUnitOfMeasureAction(
  ...args: Parameters<typeof createUnitOfMeasureActionImpl>
) {
  return createUnitOfMeasureActionImpl(...args);
}

export async function updateUnitOfMeasureAction(
  ...args: Parameters<typeof updateUnitOfMeasureActionImpl>
) {
  return updateUnitOfMeasureActionImpl(...args);
}

export async function deleteUnitOfMeasureAction(
  ...args: Parameters<typeof deleteUnitOfMeasureActionImpl>
) {
  return deleteUnitOfMeasureActionImpl(...args);
}
