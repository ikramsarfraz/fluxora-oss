"use client";

import { useQuery } from "@tanstack/react-query";
import { getPortalUser, getUsers } from "@/lib/api/portal-users";
import { getPendingInvitations } from "@/lib/api/user-invitations";
import { queryKeys } from "@/lib/query/keys";

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: getUsers,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => getPortalUser(id),
    enabled: Number.isInteger(id) && id > 0,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUserInvitations() {
  return useQuery({
    queryKey: queryKeys.users.invitations,
    queryFn: getPendingInvitations,
    staleTime: 1000 * 60 * 2,
  });
}
