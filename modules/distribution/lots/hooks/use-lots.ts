"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  createLotAction,
  deleteLotAction,
  getLotByIdAction,
  getLotsAction,
  updateLotExpirationAction,
  writeOffLotAsLossAction,
} from "@/modules/distribution/lots/actions";
import { isUuid } from "@/lib/utils/uuid";

export function useLots() {
  return useQuery({
    queryKey: queryKeys.lots.all,
    queryFn: () => getLotsAction(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLot(id: string) {
  return useQuery({
    queryKey: queryKeys.lots.detail(id),
    queryFn: () => getLotByIdAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateLot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLotAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
    },
  });
}

export function useDeleteLot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLotAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
    },
  });
}

export function useUpdateLotExpiration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLotExpirationAction,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.detail(variables.lotId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
    },
  });
}

export function useWriteOffLotAsLoss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: writeOffLotAsLossAction,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.detail(variables.lotId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
    },
  });
}
