"use client";

import { useMemo, useState } from "react";

/**
 * Client-side pagination for inline detail-page tables.
 *
 * Detail pages load all related records as part of the parent query
 * (allocations / fulfillments / line items, etc.) and most of those
 * collections are small (< a few hundred rows). Rather than introduce
 * a per-relation server endpoint, we slice the already-loaded array
 * in the client and expose the same controls the user is used to from
 * the list pages.
 *
 * Page is auto-clamped to a valid range when the underlying array
 * shrinks (e.g., a fulfillment gets reversed and the row count drops
 * below the current page) so the user never lands on an empty page.
 *
 * Usage:
 *   const pagination = useClientPagination(item.allocations, 10);
 *   <Table>
 *     {pagination.rows.map(...)}
 *   </Table>
 *   <TablePagination state={pagination} />
 */
export function useClientPagination<T>(
  rows: ReadonlyArray<T>,
  defaultPageSize: number = 10,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamp page when the underlying list shrinks. We don't useEffect for
  // this — using the derived value directly avoids an extra render and
  // keeps the rendered rows in sync with the displayed page indicator.
  const clampedPage = Math.min(Math.max(1, page), pageCount);

  const visibleRows = useMemo(
    () => rows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [rows, clampedPage, pageSize],
  );

  return {
    rows: visibleRows,
    total,
    page: clampedPage,
    pageSize,
    pageCount,
    start: total === 0 ? 0 : (clampedPage - 1) * pageSize + 1,
    end: Math.min(clampedPage * pageSize, total),
    setPage,
    setPageSize: (next: number) => {
      // Resetting to page 1 on page-size change matches the URL-driven
      // pagination behaviour the user gets on list pages.
      setPageSize(next);
      setPage(1);
    },
  };
}

export type ClientPaginationState<T> = ReturnType<typeof useClientPagination<T>>;
