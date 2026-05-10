"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

import {
  useCustomerProductPricesPage,
  useDeleteCustomerPrice,
  usePromoteProductVendor,
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

function defPrice(cost: string, markup: number) {
  return Number(cost) * (1 + markup / 100);
}

// ── VendorSubRows ─────────────────────────────────────────────────────────────

function VendorSubRows({
  vendors,
  onPromote,
  promoting,
  promotingId,
}: {
  vendors: Vendor[];
  onPromote: (supplierId: string) => void;
  promoting: boolean;
  promotingId: string | null;
}) {
  const primaryCost = Number(
    vendors.find(v => v.is_primary)?.cost_per_lb ?? vendors[0]?.cost_per_lb ?? 0,
  );

  return (
    <>
      {vendors.map(v => {
        const cost = Number(v.cost_per_lb);
        const delta = cost - primaryCost;
        const deltaPct = primaryCost > 0 ? (delta / primaryCost) * 100 : 0;
        const isPromoting = promoting && promotingId === v.supplier_id;

        return (
          <TableRow key={v.supplier_id} className="bg-stone-line2/60 hover:bg-stone-line2/80 border-stone-line2">
            <TableCell className="py-2 pl-9 pr-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-0.5 self-stretch rounded-sm shrink-0 mr-1",
                    v.is_primary ? "bg-primary" : "bg-stone-line",
                  )}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-ink">
                    {v.supplier_name}
                    {v.is_primary && (
                      <Badge className="bg-primary/10 text-primary border-primary/25 font-semibold text-[10.5px] h-4.5">
                        Primary
                      </Badge>
                    )}
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
                  v.is_primary ? "font-semibold text-stone-ink" : "font-medium text-stone-muted",
                )}
              >
                ${fmt(v.cost_per_lb)}
              </span>
              {!v.is_primary && Math.abs(delta) > 0.001 && (
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

            <TableCell /><TableCell /><TableCell />

            <TableCell className="py-2 text-center">
              {!v.is_primary && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onPromote(v.supplier_id)}
                  disabled={promoting}
                >
                  {isPromoting ? "Promoting…" : "Make primary"}
                </Button>
              )}
            </TableCell>
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
  markup,
  priceMap,
  onCommit,
  onReset,
  deleting,
  expanded,
  onToggleExpand,
  onPromote,
  promoting,
  promotingId,
}: {
  prod: CustomerProductRow;
  customerId: string;
  markup: number;
  priceMap: Map<string, string>;
  onCommit: (productId: string, value: string) => void;
  onReset: () => void;
  deleting: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onPromote: (supplierId: string) => void;
  promoting: boolean;
  promotingId: string | null;
}) {
  const key = `${customerId}:${prod.id}`;
  const storedOverride = priceMap.get(key);
  const isOverride = storedOverride !== undefined;
  const def = prod.cost ? defPrice(prod.cost, markup) : null;
  const [inputVal, setInputVal] = useState(storedOverride ?? "");
  const [focused, setFocused] = useState(false);

  const prevKey = useRef(key);
  const prevOverride = useRef(storedOverride);
  if (prevKey.current !== key || prevOverride.current !== storedOverride) {
    prevKey.current = key;
    prevOverride.current = storedOverride;
    setInputVal(storedOverride ?? "");
  }

  const displayMargin =
    def != null
      ? isOverride
        ? ((Number(storedOverride) - Number(prod.cost)) / Number(prod.cost)) * 100
        : ((def - Number(prod.cost)) / Number(prod.cost)) * 100
      : null;

  const marginClass =
    displayMargin == null
      ? "text-stone-muted/60"
      : displayMargin >= 5
        ? "text-status-good"
        : displayMargin < 0
          ? "text-destructive"
          : "text-stone-muted";

  const multiVendor = prod.vendors.length > 1;
  const primaryVendor = prod.vendors.find(v => v.is_primary) ?? prod.vendors[0] ?? null;

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
              {multiVendor && primaryVendor && (
                <div className="text-[11px] text-stone-muted/70 mt-px">
                  {primaryVendor.supplier_name}
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
              >
                <span className="text-stone-muted">
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <span className="font-mono tabular-nums text-[13px] font-medium text-stone-ink2">
                  ${fmt(prod.cost)}
                </span>
                <Badge className="bg-primary/10 text-primary text-[10.5px] h-4.5 font-medium">
                  of {prod.vendors.length}
                </Badge>
              </Button>
            ) : (
              <span className="font-mono tabular-nums text-[13px] font-medium text-stone-ink2">
                ${fmt(prod.cost)}
                <span className="text-[11px] text-stone-muted ml-0.5">/lb</span>
              </span>
            )
          ) : (
            <span className="text-[12px] text-stone-muted/60">—</span>
          )}
        </TableCell>

        <TableCell className="py-3 px-4 text-right">
          {def != null ? (
            <span className="font-mono tabular-nums text-[13px] font-medium text-stone-muted">
              ${def.toFixed(2)}
            </span>
          ) : (
            <span className="text-[12px] text-stone-muted/60">—</span>
          )}
        </TableCell>

        <TableCell className="py-2 px-4">
          {def != null ? (
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
                  placeholder={def.toFixed(2)}
                  onFocus={() => setFocused(true)}
                  onBlur={e => {
                    setFocused(false);
                    onCommit(prod.id, e.target.value);
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
                  Override
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-[12px] text-stone-muted/60">—</span>
          )}
        </TableCell>

        <TableCell className="py-3 px-4 text-right">
          {displayMargin != null ? (
            <span className={cn("font-mono tabular-nums text-[12px]", marginClass)}>
              {displayMargin >= 0 ? "+" : ""}
              {displayMargin.toFixed(1)}%
            </span>
          ) : (
            <span className="text-[12px] text-stone-muted/60">—</span>
          )}
        </TableCell>

        <TableCell className="py-3 px-4 text-center">
          {isOverride && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onReset}
              disabled={deleting}
              title="Reset to default"
            >
              <RotateCcw size={13} />
            </Button>
          )}
        </TableCell>
      </TableRow>

      {expanded && prod.vendors.length > 0 && (
        <VendorSubRows
          vendors={prod.vendors}
          onPromote={onPromote}
          promoting={promoting}
          promotingId={promotingId}
        />
      )}
      {expanded && (
        <TableRow className="hover:bg-transparent border-0">
          <TableCell colSpan={6} className="h-px bg-stone-line p-0" />
        </TableRow>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CustomerPriceSection({ customerId }: { customerId: string }) {
  const setPrice = useSetCustomerPrice();
  const deletePrice = useDeleteCustomerPrice();
  const promote = usePromoteProductVendor();
  const onError = useCallback((e: Error) => toast.error(e.message), []);

  const [markup, setMarkup] = useState(7);
  const [editingMarkup, setEditingMarkup] = useState(false);
  const [markupDraft, setMarkupDraft] = useState("7");
  const markupInputRef = useRef<HTMLInputElement>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const prevCustomerId = useRef(customerId);
  if (prevCustomerId.current !== customerId) {
    prevCustomerId.current = customerId;
    setPage(1);
    setExpandedProductId(null);
  }

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

  function commitMarkup() {
    const v = parseFloat(markupDraft);
    if (Number.isFinite(v) && v >= 0) setMarkup(v);
    setEditingMarkup(false);
  }

  function handleCommit(productId: string, rawValue: string) {
    const prod = pageData?.data.find(p => p.id === productId);
    if (!prod?.cost) return;
    const def = defPrice(prod.cost, markup);
    if (!rawValue.trim()) {
      deletePrice.mutate({ customerId, productId }, { onError });
      return;
    }
    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 0) return;
    if (Math.abs(v - def) < 0.005) {
      deletePrice.mutate({ customerId, productId }, { onError });
      toast.success("Matches default — no override stored");
      return;
    }
    setPrice.mutate({ customerId, productId, pricePerLb: v.toFixed(2) }, { onError });
  }

  function handlePromote(productId: string, supplierId: string, vendorName: string, productName: string) {
    promote.mutate(
      { productId, supplierId },
      {
        onError,
        onSuccess: () => toast.success(`${vendorName} is now primary vendor for ${productName}`),
      },
    );
  }

  const totalProducts = pageData?.totalProducts ?? 0;
  const overrideCount = pageData?.overrideCount ?? 0;

  const description = isLoading
    ? "Loading prices…"
    : `${totalProducts} products · ${overrideCount} override${overrideCount !== 1 ? "s" : ""}. Empty = cost × markup. Type a value to override; clear to revert.`;

  return (
    <DetailSection title="Prices" description={description}>
      {isLoading ? null : totalProducts === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="mt-1">
          {/* markup control */}
          <div className="flex items-center gap-1.5 mb-3 text-xs text-stone-muted">
            <span>Default markup:</span>
            {editingMarkup ? (
              <Input
                ref={markupInputRef}
                autoFocus
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={markupDraft}
                onChange={e => setMarkupDraft(e.target.value)}
                onBlur={commitMarkup}
                onKeyDown={e => {
                  if (e.key === "Enter") commitMarkup();
                  if (e.key === "Escape") setEditingMarkup(false);
                }}
                className="w-14 h-6 text-xs font-semibold px-2"
              />
            ) : (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setMarkupDraft(String(markup));
                  setEditingMarkup(true);
                  setTimeout(() => markupInputRef.current?.select(), 0);
                }}
                className="h-5 px-1 text-xs font-semibold text-stone-ink underline decoration-dotted underline-offset-2 hover:no-underline"
              >
                {markup}%
              </Button>
            )}
            <span className="text-stone-muted/60 text-[11px]">
              (used to compute Default column · not stored)
            </span>
          </div>

          {/* table */}
          <div className="border border-stone-line rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {(
                    [
                      ["Product", "auto", "text-left"],
                      ["Cost", "110px", "text-right"],
                      ["Default", "120px", "text-right"],
                      ["Their price", "190px", "text-left"],
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
                {(pageData?.data ?? []).map(prod => (
                  <ProductRow
                    key={prod.id}
                    prod={prod}
                    customerId={customerId}
                    markup={markup}
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
                    onPromote={supplierId =>
                      handlePromote(
                        prod.id,
                        supplierId,
                        prod.vendors.find(v => v.supplier_id === supplierId)?.supplier_name ?? "",
                        prod.name,
                      )
                    }
                    promoting={promote.isPending}
                    promotingId={promote.isPending ? (promote.variables?.supplierId ?? null) : null}
                  />
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
