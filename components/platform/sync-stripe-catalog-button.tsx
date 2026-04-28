"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { syncStripeCatalogAdminAction } from "@/actions/stripe-catalog-sync";
import { Button } from "@/components/ui/button";

export function SyncStripeCatalogButton() {
  const [pending, start] = useTransition();

  function onClick(): void {
    start(async () => {
      try {
        const result = await syncStripeCatalogAdminAction();
        if (result.ok) {
          const { productsUpserted, pricesUpserted } = result;
          if (productsUpserted === 0 && pricesUpserted === 0) {
            toast.warning(
              "Stripe returned no active products or prices. Confirm test mode, API key, and Stripe Dashboard catalog; then run sync again.",
              { duration: 10_000 },
            );
          } else {
            toast.success(
              `Synced Stripe catalog (${productsUpserted} product(s), ${pricesUpserted} price(s)).`,
            );
          }
          return;
        }
        toast.error(result.message, { duration: 10_000 });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Unexpected error while syncing.";
        toast.error(msg, { duration: 10_000 });
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={onClick}
      aria-busy={pending}
      aria-label={pending ? "Syncing Stripe catalog" : "Sync Stripe catalog from Stripe API"}
    >
      {pending ? "Syncing…" : "Sync Stripe catalog"}
    </Button>
  );
}
