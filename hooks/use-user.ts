"use client";

import { useQuery } from "@tanstack/react-query";

import { getPortalUser } from "@/lib/api/portal-users";
import { queryKeys } from "@/lib/query/keys";

export function useUser(id: number) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => getPortalUser(id),
    enabled: Number.isInteger(id) && id > 0,
    staleTime: 1000 * 60 * 2,
  });
}
