"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/api/customers";
import { queryKeys } from "@/lib/query/keys";

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

// export function useUpdateCustomer() {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: (id: string, input: Parameters<typeof updateCustomer>[1]) => updateCustomer(id, input),
//     onSuccess: (_data, variables) => {
//       queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
//       queryClient.invalidateQueries({
//         queryKey: queryKeys.customers.detail(variables.id),
//       });
//     },
//   });
// }

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}
