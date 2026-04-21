"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  createUnitOfMeasureAction,
  deleteUnitOfMeasureAction,
  getUnitOfMeasureAction,
  getUnitsOfMeasureAction,
  updateUnitOfMeasureAction,
} from "@/actions/units-of-measure";

export function useUnitsOfMeasure() {
  return useQuery({
    queryKey: queryKeys.unitsOfMeasure.all,
    queryFn: getUnitsOfMeasureAction,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUnitOfMeasure(id: string) {
  return useQuery({
    queryKey: queryKeys.unitsOfMeasure.detail(id),
    queryFn: () => getUnitOfMeasureAction(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUnitOfMeasureAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unitsOfMeasure.all });
    },
  });
}

export function useUpdateUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateUnitOfMeasureAction>[1];
    }) => updateUnitOfMeasureAction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unitsOfMeasure.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

export function useDeleteUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUnitOfMeasureAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unitsOfMeasure.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
