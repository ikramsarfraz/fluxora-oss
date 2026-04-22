"use client";

import { useQuery } from "@tanstack/react-query";

import { getCurrentPortalUserAction } from "@/actions/users";
import { queryKeys } from "@/lib/query/keys";

/**
 * Fetches the signed-in portal user (including `role`) for the current session.
 * Cached long because role changes are rare and any role change requires a
 * fresh session anyway.
 */
export function useCurrentPortalUser() {
  return useQuery({
    queryKey: queryKeys.currentUser.portal,
    queryFn: () => getCurrentPortalUserAction(),
    staleTime: 1000 * 60 * 5,
  });
}
