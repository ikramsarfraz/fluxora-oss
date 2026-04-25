"use server";

import { revalidatePath } from "next/cache";

import {
  dismissTenantSetupChecklist,
  getTenantSetupChecklistView,
} from "@/services/tenant-setup-checklist";
import type { TenantSetupChecklistView } from "@/services/tenant-setup-checklist";

export async function getTenantSetupChecklistViewAction(): Promise<TenantSetupChecklistView> {
  return getTenantSetupChecklistView();
}

export async function dismissTenantSetupChecklistAction(): Promise<void> {
  await dismissTenantSetupChecklist();
  revalidatePath("/dashboard");
}
