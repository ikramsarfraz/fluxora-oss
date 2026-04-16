"use client";

import { useQuery } from "@tanstack/react-query";

import { getPendingInvitations } from "@/lib/api/user-invitations";
import { queryKeys } from "@/lib/query/keys";

export function useUserInvitations() {
  return useQuery({
    queryKey: queryKeys.users.invitations,
    queryFn: getPendingInvitations,
    staleTime: 1000 * 60 * 2,
  });
}
