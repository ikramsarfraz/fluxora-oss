"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DetailSection,
} from "@/components/detail-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePager } from "@/components/table-pager";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatProductDefaultPrice } from "@/modules/distribution/products/utils/product-uom";

import { useCategoryProductsPage } from "../hooks/use-categories";

/**
 * "Products in this category" — paginated list that surfaces exactly
 * which products would lose their tag if the user picked "Untag and
 * delete" in the Danger Zone. Mirrors the customer-orders / customer-
 * invoices section pattern: server-side paging via the new hook,
 * `<TablePager />` underneath, per-row link to the product detail
 * page.
 *
 * Archived products are hidden by default with a toggle to include
 * them — matches what the rest of the codebase does (products list
 * archived filter, archived-category chip filter on products).
 */
export function CategoryProductsSection({
  categoryId,
  totalCount,
}: {
  categoryId: string;
  /**
   * The total tagged count from `useCategoryProductCount`, used to
   * route the section header copy ("3 products tagged" vs "no
   * products tagged"). The hook below fetches a paginated page of
   * the same set — when archived are excluded the paginated `total`
   * may be smaller, which is correct.
   */
  totalCount: number | undefined;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data, isLoading } = useCategoryProductsPage(categoryId, {
    page,
    pageSize,
    filters: includeArchived ? { includeArchived: "1" } : {},
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  // Section header copy reflects the unfiltered count so it doesn't
  // jump when the archived toggle flips. "3 products tagged" reads
  // the same whether or not archived are visible right now.
  const description =
    typeof totalCount === "number"
      ? totalCount === 0
        ? "No products are tagged with this category yet."
        : `${totalCount} ${totalCount === 1 ? "product is" : "products are"} tagged with this category.`
      : "Products tagged with this category.";

  return (
    <DetailSection
      title="Products in this category"
      description={description}
    >
      {totalCount && totalCount > 0 ? (
        <div className="mb-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIncludeArchived(v => !v);
              setPage(1);
            }}
          >
            {includeArchived ? "Hide archived" : "Show archived"}
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading products…</p>
      ) : rows.length === 0 ? (
        // Two empty-state cases collapse here:
        //   (a) the category genuinely has no products (totalCount===0)
        //   (b) it has only archived products and "Hide archived" is on
        // Disambiguate via totalCount so the CTA stays helpful.
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {totalCount && totalCount > 0 && !includeArchived
              ? "Only archived products are tagged with this category. Toggle “Show archived” to see them."
              : "No products are tagged with this category yet."}
          </p>
          {(!totalCount || totalCount === 0) && (
            <Button variant="outline" size="sm" asChild className="w-fit">
              <Link href="/products/new">Add product</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Default price</TableHead>
                  <TableHead className="w-32">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/products/${row.id}`}
                        className="hover:underline"
                      >
                        {row.sku}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${row.id}`}
                        className="inline-flex items-center gap-1.5 font-medium hover:underline"
                      >
                        {row.name}
                        {row.archivedAt ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full px-1.5 text-[10px] font-medium uppercase tracking-wide"
                          >
                            Archived
                          </Badge>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatProductDefaultPrice(row.defaultPricePerLb)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDate(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePager
            total={total}
            perPage={pageSize}
            page={page}
            onPageChange={setPage}
            onPerPageChange={per => {
              setPageSize(per);
              setPage(1);
            }}
          />
        </div>
      )}
    </DetailSection>
  );
}
