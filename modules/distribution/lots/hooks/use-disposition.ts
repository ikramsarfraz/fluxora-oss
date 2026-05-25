"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  applyDonateDecision,
  applyMarkdownDecision,
  createDispositionDecision,
  getDispositionDecisionsForLot,
  recordMarkdownOutcome,
} from "../services/disposition";
import type { DispositionConfig } from "../services/disposition-analytics";

export function useDispositionDecisions(lotId: string) {
  return useQuery({
    queryKey: queryKeys.disposition.forLot(lotId),
    queryFn: () => getDispositionDecisionsForLot(lotId),
    enabled: !!lotId,
  });
}

export function useCreateDisposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDispositionDecision,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.disposition.forLot(variables.lotId),
      });
    },
  });
}

export function useApplyMarkdown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: applyMarkdownDecision,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.lots.detail(variables.lotId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.disposition.forLot(variables.lotId),
      });
    },
  });
}

export function useApplyDonate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: applyDonateDecision,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.lots.detail(variables.lotId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.disposition.forLot(variables.lotId),
      });
    },
  });
}

export function useRecordMarkdownOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordMarkdownOutcome,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.disposition.forLot(variables.lotId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.markdownHistories.byCategory(variables.productCategory),
      });
    },
  });
}
