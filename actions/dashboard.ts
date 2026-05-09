"use server";

import { getDashboardSummary } from "@/modules/distribution/services/dashboard";

export async function getDashboardSummaryAction() {
  return await getDashboardSummary();
}
