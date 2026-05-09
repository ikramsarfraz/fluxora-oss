"use server";

import { revalidatePath } from "next/cache";

import {
  dismissTenantSetupChecklist,
  getTenantSetupChecklistView,
} from "@/modules/core/workspace-settings/services/setup-checklist";
import type { TenantSetupChecklistView } from "@/modules/core/workspace-settings/services/setup-checklist";

export async function getTenantSetupChecklistViewAction(): Promise<TenantSetupChecklistView> {
  return getTenantSetupChecklistView();
}

export async function dismissTenantSetupChecklistAction(): Promise<void> {
  await dismissTenantSetupChecklist();
  revalidatePath("/dashboard");
}
