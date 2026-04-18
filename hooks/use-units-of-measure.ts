"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

async function fetchUnitsOfMeasure() {
  const res = await fetch("/api/units-of-measure");
  if (!res.ok) {
    throw new Error("Failed to fetch units of measure");
  }
  return res.json();
}

async function createUnitOfMeasure(data: {
  name: string;
  abbreviation?: string;
  notes?: string;
  sortOrder?: number;
}) {
  const res = await fetch("/api/units-of-measure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to create unit of measure");
  }
  return res.json();
}

async function updateUnitOfMeasure(
  id: number,
  data: {
    name?: string;
    abbreviation?: string | null;
    notes?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  const res = await fetch(`/api/units-of-measure/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to update unit of measure");
  }
  return res.json();
}

async function deleteUnitOfMeasure(id: number) {
  const res = await fetch(`/api/units-of-measure/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to delete unit of measure");
  }
}

export function useUnitsOfMeasure() {
  return useQuery({
    queryKey: queryKeys.unitsOfMeasure.all,
    queryFn: fetchUnitsOfMeasure,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUnitOfMeasure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unitsOfMeasure.all });
    },
  });
}

export function useUpdateUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUnitOfMeasure>[1] }) =>
      updateUnitOfMeasure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unitsOfMeasure.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

export function useDeleteUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUnitOfMeasure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unitsOfMeasure.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
