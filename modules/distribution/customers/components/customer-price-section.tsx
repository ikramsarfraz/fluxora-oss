"use client";

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

import {
  useCustomerProductPricesPage,
  useDeleteCustomerPrice,
  useSetCustomerPrice,
} from "@/modules/distribution/price-chart/hooks/use-price-chart";
import { DetailSection } from "@/components/detail-section";
import { TablePager } from "@/components/table-pager";
import type { CustomerProductRow } from "@/modules/distribution/price-chart/services/price-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Vendor = CustomerProductRow["vendors"][number];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(raw: string | number | undefined | null): string {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : String(raw);
}

function marginPct(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(cost) || cost <= 0) return null;
  return ((price - cost) / cost) * 100;
}

// ── VendorSubRows ─────────────────────────────────────────────────────────────

function VendorPriceInput({
  initialValue,
  onCommit,
  onReset,
  resetting,
}: {
  initialValue: string;
  onCommit: (rawValue: string) => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const [inputVal, setInputVal] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const hasValue = initialValue !== "";

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="relative inline-flex items-center">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-muted/70 text-[10.5px] font-mono pointer-events-none">
          $
        </span>
        <Input
          type="number"
          step={0.01}
          min={0}
          value={inputVal}
          placeholder="—"
          onFocus={() => setFocused(true)}
          onBlur={e => {
            const rawValue = e.target.value;
            const parsedValue = parseFloat(rawValue);
            setFocused(false);
            if (!rawValue.trim() || !Number.isFinite(parsedValue) || parsedValue < 0) {
              setInputVal(initialValue);
            }
            onCommit(rawValue);
          }}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Tab") {
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setInputVal(initialValue);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            "w-22 pl-5 pr-1.5 text-right font-mono tabular-nums text-[12.5px] h-7",
            "focus-visible:ring-0 focus-visible:border-transparent focus-visible:shadow-none",
            focused
              ? "border-ring bg-white ring-2 ring-ring/40"
              : hasValue
                ? "border-primary/20 bg-primary/5 text-primary font-semibold shadow-none"
                : "border-transparent bg-transparent shadow-none",
          )}
        />
      </div>
      {hasValue ? (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onReset}
          disabled={resetting}
          title="Clear supplier-specific price"
        >
          <RotateCcw size={11} />
        </Button>
      ) : null}
    </div>
  );
}

function VendorSubRows({
  vendors,
  customerId,
  productId,
  onCommitVendor,
  onResetVendor,
  vendorResetState,
}: {
  vendors: Vendor[];
  customerId: string;
  productId: string;
  onCommitVendor: (supplierId: string, rawValue: string) => void;
  onResetVendor: (supplierId: string) => void;
  vendorResetState: { supplierId: string | null; isPending: boolean };
}) {
  // Vendors arrive sorted cheapest-first from the service.
  const cheapestCost = Number(vendors[0]?.cost_per_lb ?? 0);

  return (
    <>
      {vendors.map((v, i) => {
        const cost = Number(v.cost_per_lb);
        const isCheapest = i === 0;
        const delta = cost - cheapestCost;
        const deltaPct = cheapestCost > 0 ? (delta / cheapestCost) * 100 : 0;
        const initialPrice = v.customer_price != null ? fmt(v.customer_price) : "";
        const isResettingThis =
          vendorResetState.isPending && vendorResetState.supplierId === v.supplier_id;

        return (
          <TableRow
            key={`${customerId}:${productId}:${v.supplier_id}`}
            className="bg-stone-line2/60 hover:bg-stone-line2/80 border-stone-line2"
          >
            <TableCell className="py-2 pl-9 pr-4">
              <div className="flex items-center gap-2">
                <div className="w-0.5 self-stretch rounded-sm shrink-0 mr-1 bg-stone-line" />
                <div>
                  <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-ink">
                    {v.supplier_name}
                  </div>
                  {v.last_received_at && (
                    <div className="text-[11px] text-stone-muted/70 mt-0.5">
                      Last received{" "}
                      {new Date(v.last_received_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TableCell>

            <TableCell className="py-2 text-right">
              <span
                className={cn(
                  "font-mono tabular-nums text-[13px]",
                  isCheapest ? "font-semibold text-stone-ink" : "font-medium text-stone-muted",
                )}
              >
                ${fmt(v.cost_per_lb)}
              </span>
              {!isCheapest && Math.abs(delta) > 0.001 && (
                <div
                  className={cn(
                    "text-[10.5px] font-mono tabular-nums mt-0.5",
                    delta > 0 ? "text-destructive" : "text-status-good",
                  )}
                >
                  {delta > 0 ? "+" : ""}${Math.abs(delta).toFixed(2)} ({deltaPct > 0 ? "+" : ""}
                  {deltaPct.toFixed(1)}%)
                </div>
              )}
            </TableCell>

            <TableCell className="py-2 px-4">
              <VendorPriceInput
                key={`${v.supplier_id}:${initialPrice}`}
                initialValue={initialPrice}
                onCommit={raw => onCommitVendor(v.supplier_id, raw)}
                onReset={() => onResetVendor(v.supplier_id)}
                resetting={isResettingThis}
              />
            </TableCell>

            <TableCell className="py-2 text-right">
              {(() => {
                if (v.customer_price == null) {
                  return <span className="text-[11px] text-stone-muted/60">—</span>;
                }
                const m = marginPct(Number(v.customer_price), cost);
                if (m == null) return <span className="text-[11px] text-stone-muted/60">—</span>;
                const cls =
                  m >= 5
                    ? "text-status-good"
                    : m < 0
                      ? "text-destructive"
                      : "text-stone-muted";
                return (
                  <span className={cn("font-mono tabular-nums text-[11.5px]", cls)}>
                    {m >= 0 ? "+" : ""}
                    {m.toFixed(1)}%
                  </span>
                );
              })()}
            </TableCell>

            <TableCell />
          </TableRow>
        );
      })}
    </>
  );
}

// ── ProductRow ────────────────────────────────────────────────────────────────

function ProductRow({
  prod,
  customerId,
  priceMap,
  onCommit,
  onReset,
  deleting,
  expanded,
  onToggleExpand,
  onCommitVendor,
  onResetVendor,
  vendorResetState,
}: {
  prod: CustomerProductRow;
  customerId: string;
  priceMap: Map<string, string>;
  onCommit: (productId: string, value: string) => void;
  onReset: () => void;
  deleting: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onCommitVendor: (productId: string, supplierId: string, value: string) => void;
  onResetVendor: (productId: string, supplierId: string) => void;
  vendorResetState: { productId: string | null; supplierId: string | null; isPending: boolean };
}) {
  const key = `${customerId}:${prod.id}`;
  const storedOverride = priceMap.get(key);
  const isOverride = storedOverride !== undefined;
  const cost = Number(prod.cost);
  const displayMargin = isOverride ? marginPct(Number(storedOverride), cost) : null;
  const [inputVal, setInputVal] = useState(storedOverride ?? "");
  const [focused, setFocused] = useState(false);

  const marginClass =
    displayMargin == null
      ? "text-stone-muted/60"
      : displayMargin >= 5
        ? "text-status-good"
        : displayMargin < 0
          ? "text-destructive"
          : "text-stone-muted";

  const multiVendor = prod.vendors.length > 1;

  const vendorCosts = prod.vendors
    .map(v => Number(v.cost_per_lb))
    .filter(n => Number.isFinite(n) && n > 0);
  const minCost = vendorCosts.length ? Math.min(...vendorCosts) : null;
  const maxCost = vendorCosts.length ? Math.max(...vendorCosts) : null;
  const costsDiffer =
    minCost != null && maxCost != null && Math.abs(maxCost - minCost) > 0.001;

  return (
    <>
      <TableRow className={expanded ? "border-0" : undefined}>
        <TableCell className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="font-mono text-[10.5px] text-stone-muted bg-muted px-1.5 py-0.5 rounded min-w-20 text-center shrink-0">
              {prod.sku}
            </div>
            <div>
              <div className="text-[13px] font-medium text-stone-ink">{prod.name}</div>
              {multiVendor && (
                <div className="text-[11px] text-stone-muted/70 mt-px">
                  {prod.vendors.length} suppliers
                </div>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell className="py-3 px-4 text-right">
          {prod.cost ? (
            multiVendor ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className={cn("gap-1.5 px-1.5 h-7 font-normal", expanded && "bg-muted")}
                title="Expand to see each supplier"
              >
                <span className="text-stone-muted">
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <span className="font-mono tabular-nums text-[13px] font-medium text-stone-ink2">
                  {costsDiffer && minCost != null && maxCost != null ? (
                    <>
                      <span className="text-[11px] text-stone-muted font-normal mr-0.5">from</span>
                      ${fmt(minCost)}
                      <span className="text-stone-muted/60 mx-0.5">–</span>${fmt(maxCost)}
                    </>
                  ) : (
                    <>${fmt(minCost ?? prod.cost)}</>
                  )}
                </span>
              </Button>
            ) : (
              <span className="font-mono tabular-nums text-[13px] font-medium text-stone-ink2">
                ${fmt(prod.cost)}
                <span className="text-[11px] text-stone-muted ml-0.5">/lb</span>
              </span>
            )
          ) : (
            <span className="text-[12px] text-stone-muted/60">No cost</span>
          )}
        </TableCell>

        <TableCell className="py-2 px-4">
          {multiVendor ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-8 px-2 text-[12px] font-normal text-stone-muted hover:text-stone-ink gap-1"
            >
              {expanded ? "Hide suppliers" : "Set per supplier"}
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </Button>
          ) : (
            <div className="inline-flex items-center gap-2">
              <div className="relative inline-flex items-center">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-muted/70 text-xs font-mono pointer-events-none">
                  $
                </span>
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  value={inputVal}
                  placeholder="—"
                  onFocus={() => setFocused(true)}
                  onBlur={e => {
                    const rawValue = e.target.value;
                    const parsedValue = parseFloat(rawValue);
                    setFocused(false);
                    if (!rawValue.trim() || !Number.isFinite(parsedValue) || parsedValue < 0) {
                      setInputVal(storedOverride ?? "");
                    }
                    onCommit(prod.id, rawValue);
                  }}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      setInputVal(storedOverride ?? "");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className={cn(
                    "w-27.5 pl-6 pr-2 text-right font-mono tabular-nums text-[13px] h-9",
                    "focus-visible:ring-0 focus-visible:border-transparent focus-visible:shadow-none",
                    focused
                      ? "border-ring bg-white ring-3 ring-ring/50"
                      : isOverride
                        ? "border-primary/20 bg-primary/5 text-primary font-semibold shadow-none"
                        : "border-transparent bg-transparent shadow-none",
                  )}
                />
              </div>
              {isOverride && (
                <Badge className="bg-primary/5 text-primary text-[10.5px] h-4.5 gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Set
                </Badge>
              )}
            </div>
          )}
        </TableCell>

        <TableCell className="py-3 px-4 text-right">
          {multiVendor ? (
            <span className="text-[12px] text-stone-muted/60">—</span>
          ) : displayMargin != null ? (
            <span className={cn("font-mono tabular-nums text-[12px]", marginClass)}>
              {displayMargin >= 0 ? "+" : ""}
              {displayMargin.toFixed(1)}%
            </span>
          ) : (
            <span className="text-[12px] text-stone-muted/60">—</span>
          )}
        </TableCell>

        <TableCell className="py-3 px-4 text-center">
          {!multiVendor && isOverride && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onReset}
              disabled={deleting}
              title="Clear customer price"
            >
              <RotateCcw size={13} />
            </Button>
          )}
        </TableCell>
      </TableRow>

      {expanded && prod.vendors.length > 0 && (
        <VendorSubRows
          vendors={prod.vendors}
          customerId={customerId}
          productId={prod.id}
          onCommitVendor={(supplierId, raw) => onCommitVendor(prod.id, supplierId, raw)}
          onResetVendor={supplierId => onResetVendor(prod.id, supplierId)}
          vendorResetState={{
            supplierId:
              vendorResetState.productId === prod.id ? vendorResetState.supplierId : null,
            isPending:
              vendorResetState.isPending && vendorResetState.productId === prod.id,
          }}
        />
      )}
      {expanded && (
        <TableRow className="hover:bg-transparent border-0">
          <TableCell colSpan={5} className="h-px bg-stone-line p-0" />
        </TableRow>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CustomerPriceSection({ customerId }: { customerId: string }) {
  const setPrice = useSetCustomerPrice();
  const deletePrice = useDeleteCustomerPrice();
  const onError = useCallback((e: Error) => toast.error(e.message), []);

  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: pageData, isLoading } = useCustomerProductPricesPage(customerId, {
    page,
    pageSize,
  });

  const priceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of pageData?.data ?? []) {
      if (row.customerPrice != null) {
        m.set(`${customerId}:${row.id}`, fmt(row.customerPrice));
      }
    }
    return m;
  }, [pageData, customerId]);

  const grouped = useMemo(() => {
    const map = new Map<string, CustomerProductRow[]>();
    for (const p of pageData?.data ?? []) {
      const cat = p.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pageData]);

  function handleCommit(productId: string, rawValue: string) {
    if (!rawValue.trim()) {
      deletePrice.mutate({ customerId, productId }, { onError });
      return;
    }
    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 0) return;
    setPrice.mutate({ customerId, productId, pricePerLb: v.toFixed(2) }, { onError });
  }

  function handleCommitVendor(productId: string, supplierId: string, rawValue: string) {
    if (!rawValue.trim()) {
      deletePrice.mutate({ customerId, productId, supplierId }, { onError });
      return;
    }
    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 0) return;
    setPrice.mutate(
      { customerId, productId, supplierId, pricePerLb: v.toFixed(2) },
      { onError },
    );
  }

  function handleResetVendor(productId: string, supplierId: string) {
    deletePrice.mutate({ customerId, productId, supplierId }, { onError });
  }

  const totalProducts = pageData?.totalProducts ?? 0;
  const overrideCount = pageData?.overrideCount ?? 0;

  const description = isLoading
    ? "Loading prices…"
    : `${totalProducts} products · ${overrideCount} customer price${overrideCount !== 1 ? "s" : ""}`;

  return (
    <DetailSection title="Prices" description={description}>
      {isLoading ? null : totalProducts === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="mt-1">
          <div className="border border-stone-line rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {(
                    [
                      ["Product", "auto", "text-left"],
                      ["Cost", "110px", "text-right"],
                      ["Price", "190px", "text-left"],
                      ["Margin", "90px", "text-right"],
                      ["", "44px", "text-center"],
                    ] as const
                  ).map(([label, w, align], i) => (
                    <TableHead
                      key={i}
                      className={cn(
                        align,
                        "text-[11px] font-semibold text-stone-muted uppercase tracking-[0.04em] bg-stone-line2/40 px-4 py-2.5 h-auto",
                      )}
                      style={{ width: w === "auto" ? undefined : w }}
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([cat, prods], gi) => (
                  <React.Fragment key={cat}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className={cn(
                          "bg-stone-line2/40 px-4 py-3 pb-1.5 text-[11px] font-semibold text-stone-muted uppercase tracking-widest",
                          gi > 0 && "border-t border-stone-line",
                        )}
                      >
                        {cat}
                        <span className="text-stone-muted/60 ml-2 font-medium">{prods.length}</span>
                      </TableCell>
                    </TableRow>
                    {prods.map(prod => (
                      <ProductRow
                        key={`${prod.id}:${priceMap.get(`${customerId}:${prod.id}`) ?? ""}`}
                        prod={prod}
                        customerId={customerId}
                        priceMap={priceMap}
                        onCommit={handleCommit}
                        onReset={() =>
                          deletePrice.mutate({ customerId, productId: prod.id }, { onError })
                        }
                        deleting={
                          deletePrice.isPending &&
                          deletePrice.variables?.productId === prod.id &&
                          deletePrice.variables?.customerId === customerId
                        }
                        expanded={expandedProductId === prod.id}
                        onToggleExpand={() =>
                          setExpandedProductId(id => (id === prod.id ? null : prod.id))
                        }
                        onCommitVendor={handleCommitVendor}
                        onResetVendor={handleResetVendor}
                        vendorResetState={{
                          productId: deletePrice.isPending
                            ? (deletePrice.variables?.productId ?? null)
                            : null,
                          supplierId: deletePrice.isPending
                            ? (deletePrice.variables?.supplierId ?? null)
                            : null,
                          isPending: deletePrice.isPending,
                        }}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
            <TablePager
              total={pageData?.total ?? 0}
              perPage={pageSize}
              page={page}
              onPageChange={p => { setPage(p); setExpandedProductId(null); }}
              onPerPageChange={ps => { setPageSize(ps); setPage(1); setExpandedProductId(null); }}
            />
          </div>
        </div>
      )}
    </DetailSection>
  );
}
