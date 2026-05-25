"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { listPendingBulkImportFilesAction } from "../../actions";

import { rowToBatchFile } from "./entry-to-batch-file";
import type { BatchFile, BatchView } from "./types";

/**
 * Reads every pending bulk-import row from the server (PR A1's
 * `bulk_import_files` table) via React Query and shapes the result for the
 * bulk-landing screen. React Query's `refetchOnWindowFocus` plus invalidation
 * after a successful review keeps the list fresh without explicit cross-tab
 * plumbing.
 */
export function useBulkBatchView(): {
  view: BatchView | null;
  refresh: () => void;
} {
  const query = useQuery({
    queryKey: ["bulk-import-files", "pending"] as const,
    queryFn: () => listPendingBulkImportFilesAction(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const files: BatchFile[] | null = useMemo(() => {
    if (!query.data) return null;
    return query.data.map(rowToBatchFile);
  }, [query.data]);

  const refresh = () => {
    void query.refetch();
  };

  if (files === null) return { view: null, refresh };

  const reviewed = files.filter(f => f.status === "reviewed").length;
  const combinedValue = files.reduce((sum, f) => sum + f.totalAmount, 0);

  return {
    view: {
      files,
      summary: {
        filesProcessed: files.length,
        readyToPost: reviewed,
        needsReview: files.length - reviewed,
        combinedValue,
      },
    },
    refresh,
  };
}
