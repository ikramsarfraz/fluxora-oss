"use server";

import { getDashboardSummary } from "@/services/dashboard";

export async function getDashboardSummaryAction() {
  return await getDashboardSummary();
}
