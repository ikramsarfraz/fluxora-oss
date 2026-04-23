"use server";

import { getApAging, getArAging } from "@/services/aging";

export async function getArAgingAction() {
  return await getArAging();
}

export async function getApAgingAction() {
  return await getApAging();
}
