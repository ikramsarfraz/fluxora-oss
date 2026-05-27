"use client";

import { useQuery } from "@tanstack/react-query";

import { getTenantSettingsAction } from "@/modules/core/workspace-settings/actions";
import { queryKeys } from "@/lib/query/keys";

/**
 * Lightweight read for the tenant's display preferences (#232 phase 1):
 * baseCurrency, taxInclusive, defaultTaxRate.
 *
 * Long stale time — these values change only via the workspace settings
 * card, which invalidates this key on save (see
 * `updateCurrencyTaxSettingsAction`).
 *
 * Phase 1 plumbs only a handful of high-traffic surfaces; the remaining
 * 200+ formatMoney call sites stay USD-by-default and will be swept in
 * phase 1.5.
 */
export function useTenantSettings() {
  return useQuery({
    queryKey: queryKeys.tenant.settings,
    queryFn: () => getTenantSettingsAction(),
    staleTime: 1000 * 60 * 30,
  });
}
