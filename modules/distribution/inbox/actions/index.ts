"use server";

import { getInboxBellSummary } from "../services/inbox";

export async function getInboxBellSummaryAction() {
  return await getInboxBellSummary();
}
