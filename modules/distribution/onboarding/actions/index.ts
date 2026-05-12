"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

export async function completeOnboarding(input: {
  businessName: string;
  businessCategory: "meat_poultry" | "seafood" | "produce" | "bakery_dry";
  billSource: string;
}) {
  const tenant = await getCurrentTenant();
  const now = new Date();

  await db
    .update(tenants)
    .set({
      name: input.businessName,
      businessCategory: input.businessCategory,
      onboardingCompletedAt: now,
      welcomeSkippedAt: now,
    })
    .where(eq(tenants.id, tenant.id));
}

export async function skipWelcome() {
  const tenant = await getCurrentTenant();

  await db
    .update(tenants)
    .set({ welcomeSkippedAt: new Date() })
    .where(eq(tenants.id, tenant.id));
}

export async function getOnboardingStatus() {
  const tenant = await getCurrentTenant();
  return {
    onboardingCompleted: tenant.onboardingCompletedAt !== null,
    billCount: tenant.billCount,
    businessCategory: tenant.businessCategory,
    name: tenant.name,
  };
}
