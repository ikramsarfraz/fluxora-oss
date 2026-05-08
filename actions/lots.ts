"use server";

import {
  createLotAction as createLotActionImpl,
  deleteLotAction as deleteLotActionImpl,
  getLotByIdAction as getLotByIdActionImpl,
  getLotsAction as getLotsActionImpl,
} from "@/modules/distribution/lots/actions";

export async function getLotsAction() {
  return getLotsActionImpl();
}

export async function getLotByIdAction(
  ...args: Parameters<typeof getLotByIdActionImpl>
) {
  return getLotByIdActionImpl(...args);
}

export async function createLotAction(
  ...args: Parameters<typeof createLotActionImpl>
) {
  return createLotActionImpl(...args);
}

export async function deleteLotAction(
  ...args: Parameters<typeof deleteLotActionImpl>
) {
  return deleteLotActionImpl(...args);
}
