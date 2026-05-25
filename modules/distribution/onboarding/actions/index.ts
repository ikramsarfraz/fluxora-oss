"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { captureServerEvent } from "@/lib/posthog-server";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

export async function completeOnboarding(input: {
  businessName: string;
  businessCategory: "meat_poultry" | "seafood" | "produce" | "bakery_dry";
  billSource: string;
}) {
  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  // Onboarding overwrites tenant.name + tenant.businessCategory — only
  // the workspace owner should be able to do that. Invited admins /
  // sales users hitting this form (e.g. via a subscription-guard
  // redirect when the owner hadn't skipped /get-started yet) could
  // otherwise rename the workspace on the owner's behalf.
  if (user.role !== "owner") {
    throw new Error("Only the workspace owner can complete onboarding.");
  }
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

  await captureServerEvent({
    userId: user.id,
    tenantId: tenant.id,
    event: "welcome.completed",
    properties: { business_category: input.businessCategory },
  });
}

export async function skipWelcome() {
  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  // Same rationale as completeOnboarding — flipping welcomeSkippedAt
  // closes the redirect-loop for every member of the workspace; only
  // the owner should make that call.
  if (user.role !== "owner") {
    throw new Error("Only the workspace owner can skip onboarding.");
  }

  await db
    .update(tenants)
    .set({ welcomeSkippedAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  await captureServerEvent({
    userId: user.id,
    tenantId: tenant.id,
    event: "welcome.skipped",
  });
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
