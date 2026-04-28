"use server";

import { revalidatePath } from "next/cache";

import { syncStripeCatalogFullFromStripeApi } from "@/services/stripe-catalog";
import { requirePlatformUser } from "@/services/platform-users";

export async function syncStripeCatalogAdminAction(): Promise<
  | { ok: true; productsUpserted: number; pricesUpserted: number }
  | { ok: false; message: string }
> {
  try {
    const pu = await requirePlatformUser();
    const result = await syncStripeCatalogFullFromStripeApi({
      actorType: "platform_user",
      platformUserId: pu.id,
    });
    revalidatePath("/admin/subscriptions");
    return { ok: true, ...result };
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : "Sync failed.";
    return { ok: false, message: msg };
  }
}
