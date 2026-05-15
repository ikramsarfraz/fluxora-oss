"use client";

import { useCallback, useEffect, useState } from "react";

import { listPendingBulkImports } from "../../utils/bulk-import-storage";

import { entryToBatchFile } from "./entry-to-batch-file";
import type { BatchFile, BatchView } from "./types";

function scanFiles(): BatchFile[] | null {
  if (typeof window === "undefined") return null;
  return listPendingBulkImports().map(({ key, entry }) =>
    entryToBatchFile({ key, entry }),
  );
}

/**
 * Reads all bulk-import handoffs out of localStorage and returns them as the
 * `BatchView` the new bulk-landing screen consumes. Listens for cross-tab
 * `storage` events + a same-tab focus event so a review tab marking an entry
 * `reviewed` reflects back on the landing screen without a manual reload.
 *
 * Initial scan runs via a lazy `useState` initializer so we don't have to
 * call `setState` from inside the mount effect (which would trip the React
 * Compiler's cascading-renders rule).
 */
export function useBulkBatchView(): {
  view: BatchView | null;
  refresh: () => void;
} {
  const [files, setFiles] = useState<BatchFile[] | null>(scanFiles);

  const refresh = useCallback(() => {
    const next = scanFiles();
    if (next) setFiles(next);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith("fluxora:bulk-import:")) {
        refresh();
      }
    };
    const onFocus = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

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
