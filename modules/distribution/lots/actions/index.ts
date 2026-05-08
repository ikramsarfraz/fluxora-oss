"use server";

import {
  createLot,
  deleteLot,
  getLotById,
  getLots,
} from "../services/lots";

export async function getLotsAction() {
  return await getLots();
}

export async function getLotByIdAction(id: string) {
  return await getLotById(id);
}

export async function createLotAction(input: {
  lotNumber: string;
  supplierId: string;
  receiveDate: string;
  expirationDate: string;
}) {
  return await createLot(input);
}

export async function deleteLotAction(id: string) {
  return await deleteLot(id);
}
