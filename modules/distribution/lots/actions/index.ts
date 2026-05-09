"use server";

import {
  createLot,
  deleteLot,
  getLotById,
  getLots,
  updateLotExpiration,
  writeOffLotAsLoss,
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

export async function updateLotExpirationAction(input: {
  lotId: string;
  expirationDate: string;
}) {
  return await updateLotExpiration(input);
}

export async function writeOffLotAsLossAction(input: {
  lotId: string;
  targetStatus: "expired" | "damaged";
  reason: string;
  notes?: string | null;
}) {
  return await writeOffLotAsLoss(input);
}
