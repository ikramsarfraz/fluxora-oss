"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getUsers } from "@/lib/api/portal-users";

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: getUsers,
    staleTime: 1000 * 60 * 5,
  });
}
