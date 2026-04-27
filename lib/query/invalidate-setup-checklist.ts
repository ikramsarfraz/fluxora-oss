import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "./keys";

/** When tenant data used by the dashboard setup checklist changes, refetch the checklist query. */
export function invalidateSetupChecklistQuery(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.dashboard.setupChecklist });
}
