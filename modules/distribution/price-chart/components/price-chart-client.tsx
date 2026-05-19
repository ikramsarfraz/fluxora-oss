"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCcw, Search, Truck } from "lucide-react";
import {
  useApplyMarkupToCustomer,
  useCustomerProductPricesPage,
  useDeleteCustomerPrice,
  usePriceChart,
  useSetCustomerPrice,
  useUpdateCustomerFuelSurcharge,
} from "../hooks/use-price-chart";
import type { CustomerProductRow, PriceChartData } from "../services/price-chart";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { TablePager } from "@/components/table-pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type Product = PriceChartData["products"][number];
// Vendor here mirrors what the paginated customer/products query returns,
// which includes per-supplier `customer_price`. The top-level PriceChartData
// shape only has cost data.
type Vendor = CustomerProductRow["vendors"][number];
type Customer = PriceChartData["customers"][number];

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(raw: string | number | undefined | null): string {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : String(raw);
}

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function marginPct(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(cost) || cost <= 0) return null;
  return ((price - cost) / cost) * 100;
}

function overrideCount(prices: PriceChartData["prices"], customerId: string): number {
  return prices.filter(p => p.customer_id === customerId).length;
}

// ── CustomerList ──────────────────────────────────────────────────────────────

function CustomerList({
  customers,
  prices,
  selected,
  onSelect,
}: {
  customers: Customer[];
  prices: PriceChartData["prices"];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = customers.filter(
    c => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card
      className="w-75 shrink-0 gap-0 p-0 rounded-[10px] overflow-hidden sticky top-20 flex-col"
      style={{ maxHeight: "calc(100vh - 110px)" }}
    >
      <div className="px-4 pt-3.5 pb-2.5 border-b border-border-default">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-subtle uppercase tracking-wider">
            Customers
          </span>
          <Badge variant="secondary" className="text-[11px] px-2">{filtered.length}</Badge>
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search size={14} />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="text-[13px]"
          />
        </InputGroup>
      </div>

      <div className="overflow-y-auto py-1.5 flex-1">
        {filtered.map(c => {
          const isActive = c.id === selected;
          const ovr = overrideCount(prices, c.id);
          const fuel = c.fuel_surcharge_amount;
          return (
            <Button
              key={c.id}
              variant="ghost"
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full h-auto justify-start gap-3 rounded-none py-2.5 px-4",
                isActive && "bg-primary/5 hover:bg-primary/8",
              )}
              style={{ borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent" }}
            >
              <div
                className={cn(
                  "w-7 h-7 shrink-0 rounded-[7px] grid place-items-center text-[11px] font-semibold",
                  isActive ? "bg-primary text-white" : "bg-muted text-ink-warm",
                )}
              >
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[13px] font-medium leading-snug truncate text-ink">
                  {c.name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-subtle">
                  {fuel && Number(fuel) > 0 && <span>${fmt(fuel)} fuel</span>}
                  {ovr > 0 && (
                    <span className="text-primary font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                      {ovr}
                    </span>
                  )}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

// ── CustomerCard ──────────────────────────────────────────────────────────────

function CustomerCard({
  customer,
  prices,
  allProducts,
  markup,
  onMarkupChange,
  onApplyMarkup,
  applyingMarkup,
}: {
  customer: Customer;
  prices: PriceChartData["prices"];
  allProducts: Product[];
  markup: number;
  onMarkupChange: (v: number) => void;
  onApplyMarkup: () => void;
  applyingMarkup: boolean;
}) {
  const [editingMarkup, setEditingMarkup] = useState(false);
  const [markupDraft, setMarkupDraft] = useState(String(markup));
  const inputRef = useRef<HTMLInputElement>(null);

  const ovr = overrideCount(prices, customer.id);
  const totalProducts = allProducts.length;

  const avgMargin = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const p of allProducts) {
      const cost = Number(p.cost);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      const custPrice = prices.find(
        pr => pr.customer_id === customer.id && pr.product_id === p.id,
      );
      if (!custPrice) continue;
      const margin = marginPct(Number(custPrice.price_per_lb), cost);
      if (margin == null) continue;
      sum += margin;
      count += 1;
    }
    return count > 0 ? sum / count : null;
  }, [allProducts, prices, customer.id]);

  function commitMarkup() {
    const v = parseFloat(markupDraft);
    if (Number.isFinite(v) && v >= 0) {
      onMarkupChange(v);
      toast.success(`Markup set to ${v}%`);
    }
    setEditingMarkup(false);
  }

  return (
    <Card className="flex-row items-center gap-4 px-5 py-4 rounded-[10px] overflow-visible">
      <div className="w-12 h-12 shrink-0 rounded-[10px] bg-primary/10 text-primary grid place-items-center font-semibold text-base">
        {initials(customer.name)}
      </div>
      <div>
        <div className="text-lg font-semibold tracking-tight text-ink">{customer.name}</div>
      </div>
      <div className="flex-1" />

      <div className="flex border border-border-default rounded-md overflow-hidden">
        <Button
          variant="ghost"
          onClick={() => {
            setEditingMarkup(true);
            setMarkupDraft(String(markup));
            setTimeout(() => inputRef.current?.select(), 0);
          }}
          title="Click to edit bulk markup"
          className="h-auto min-w-27.5 flex-col items-start gap-0.5 rounded-none border-r border-border-default px-3.5 py-2.5 hover:bg-muted/60"
        >
          <span className="text-[10.5px] text-subtle uppercase tracking-[0.04em] font-semibold">
            Bulk markup
          </span>
          {editingMarkup ? (
            <div className="flex items-baseline gap-1">
              <Input
                ref={inputRef}
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
                className="w-14 h-7 text-sm font-semibold px-2"
              />
              <span className="text-xs text-subtle">%</span>
            </div>
          ) : (
            <div className="text-base font-semibold tracking-tight text-ink">
              {markup}
              <span className="text-xs text-subtle font-medium ml-px">%</span>
            </div>
          )}
        </Button>

        <div className="px-3.5 py-2.5 min-w-32.5 border-r border-border-default flex flex-col gap-0.5">
          <span className="text-[10.5px] text-subtle uppercase tracking-[0.04em] font-semibold">
            Customer prices
          </span>
          <div className="text-base font-semibold tracking-tight text-ink">
            {ovr}
            <span className="text-xs text-subtle font-medium ml-0.5">/ {totalProducts}</span>
          </div>
        </div>

        <div className="px-3.5 py-2.5 min-w-30 flex flex-col gap-0.5">
          <span className="text-[10.5px] text-subtle uppercase tracking-[0.04em] font-semibold">
            Avg margin
          </span>
          <div className="text-base font-semibold tracking-tight text-ink">
            {avgMargin == null ? (
              <span className="text-subtle/60 text-sm font-normal">—</span>
            ) : (
              <>
                {avgMargin >= 0 ? "+" : ""}
                {avgMargin.toFixed(1)}
                <span className="text-xs text-subtle font-medium ml-px">%</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onApplyMarkup}
        disabled={applyingMarkup}
        title={`Set this customer's prices from supplier cost plus ${markup}%`}
      >
        {applyingMarkup ? "Applying…" : `Apply ${markup}% markup`}
      </Button>
    </Card>
  );
}

// ── FuelCard ──────────────────────────────────────────────────────────────────

function FuelCard({
  customer,
  onSave,
  saving,
}: {
  customer: Customer;
  onSave: (amount: string | null) => void;
  saving: boolean;
}) {
  const current =
    customer.fuel_surcharge_amount != null ? fmt(customer.fuel_surcharge_amount) : "0.00";
  const [val, setVal] = useState(current);

  return (
    <Card className="flex-row items-center gap-3.5 px-4 py-3 rounded-[10px] bg-warning-bg ring-warning-border/20">
      <div className="w-8 h-8 shrink-0 rounded-lg bg-warning-fg/20 text-warning-fg grid place-items-center">
        <Truck size={16} />
      </div>
      <div className="flex-1">
        <div className="text-[12.5px] font-medium text-ink">Fuel surcharge</div>
        <div className="text-[11.5px] text-subtle mt-0.5">
          Flat fee added to every order. Set to 0 to waive.
        </div>
      </div>
      <InputGroup className="w-20 bg-card" data-disabled={saving ? "true" : undefined}>
        <InputGroupAddon align="inline-start">$</InputGroupAddon>
        <InputGroupInput
          type="number"
          step={0.5}
          min={0}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => {
            const n = parseFloat(val);
            const amt = Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
            onSave(amt);
          }}
          onKeyDown={e => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={saving}
          className="text-right font-mono tabular-nums font-medium text-[13px]"
        />
      </InputGroup>
    </Card>
  );
}

// ── VendorPriceInput ──────────────────────────────────────────────────────────

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
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-subtle/70 text-[10.5px] font-mono pointer-events-none">
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
              ? "border-ring bg-card ring-2 ring-ring/40"
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

// ── VendorSubRows ─────────────────────────────────────────────────────────────

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
            className="bg-divider/60 hover:bg-divider/80 border-divider"
          >
            <TableCell className="py-2 pl-8 pr-4">
              <div className="flex items-center gap-2">
                <div className="w-0.5 self-stretch rounded-sm shrink-0 mr-1 bg-surface-deep" />
                <div>
                  <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    {v.supplier_name}
                  </div>
                  {v.last_received_at && (
                    <div className="text-[11px] text-subtle/70 mt-0.5">
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
                  isCheapest ? "font-semibold text-ink" : "font-medium text-subtle",
                )}
              >
                ${fmt(v.cost_per_lb)}
              </span>
              {!isCheapest && Math.abs(delta) > 0.001 && (
                <div
                  className={cn(
                    "text-[10.5px] font-mono tabular-nums mt-0.5",
                    delta > 0 ? "text-destructive" : "text-success-fg",
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
                  return <span className="text-[11px] text-subtle/60">—</span>;
                }
                const m = marginPct(Number(v.customer_price), cost);
                if (m == null) return <span className="text-[11px] text-subtle/60">—</span>;
                const cls =
                  m >= 5
                    ? "text-success-fg"
                    : m < 0
                      ? "text-destructive"
                      : "text-subtle";
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
  customer,
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
  customer: Customer;
  priceMap: Map<string, string>;
  onCommit: (productId: string, value: string) => void;
  onReset: () => void;
  deleting: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onCommitVendor: (productId: string, supplierId: string, rawValue: string) => void;
  onResetVendor: (productId: string, supplierId: string) => void;
  vendorResetState: { productId: string | null; supplierId: string | null; isPending: boolean };
}) {
  const key = `${customer.id}:${prod.id}`;
  const storedOverride = priceMap.get(key);
  const isOverride = storedOverride !== undefined;
  const cost = Number(prod.cost);
  const displayMargin = isOverride ? marginPct(Number(storedOverride), cost) : null;
  const [inputVal, setInputVal] = useState(storedOverride ?? "");
  const [focused, setFocused] = useState(false);

  const marginClass =
    displayMargin == null
      ? "text-subtle/60"
      : displayMargin >= 5
        ? "text-success-fg"
        : displayMargin < 0
          ? "text-destructive"
          : "text-subtle";

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
          <div className="flex items-center gap-3.5">
            <div className="font-mono text-[10.5px] text-subtle bg-muted px-1.5 py-0.5 rounded min-w-21.5 text-center shrink-0 tracking-wide">
              {prod.sku}
            </div>
            <div>
              <div className="text-[13px] font-medium text-ink">{prod.name}</div>
              {multiVendor && (
                <div className="text-[11px] text-subtle/70 mt-0.5">
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
                <span className="text-subtle">
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <span className="font-mono tabular-nums text-[13px] font-medium text-ink-warm">
                  {costsDiffer && minCost != null && maxCost != null ? (
                    <>
                      <span className="text-[11px] text-subtle font-normal mr-0.5">from</span>
                      ${fmt(minCost)}
                      <span className="text-subtle/60 mx-0.5">–</span>${fmt(maxCost)}
                    </>
                  ) : (
                    <>${fmt(minCost ?? prod.cost)}</>
                  )}
                </span>
              </Button>
            ) : (
              <span className="font-mono tabular-nums text-[13px] font-medium text-ink-warm">
                ${fmt(prod.cost)}
                <span className="text-[11px] text-subtle ml-0.5">/lb</span>
              </span>
            )
          ) : (
            <span className="text-[12px] text-subtle/60">No cost</span>
          )}
        </TableCell>

        <TableCell className="py-2 px-4">
          {multiVendor ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-8 px-2 text-[12px] font-normal text-subtle hover:text-ink gap-1"
            >
              {expanded ? "Hide suppliers" : "Set per supplier"}
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </Button>
          ) : (
            <div className="inline-flex items-center gap-2">
              <div className="relative inline-flex items-center">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle/70 text-xs font-mono pointer-events-none">
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
                      ? "border-ring bg-card ring-3 ring-ring/50"
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
            <span className="text-[12px] text-subtle/60">—</span>
          ) : displayMargin != null ? (
            <span className={cn("font-mono tabular-nums text-[12px]", marginClass)}>
              {displayMargin >= 0 ? "+" : ""}
              {displayMargin.toFixed(1)}%
            </span>
          ) : (
            <span className="text-[12px] text-subtle/60">—</span>
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
          customerId={customer.id}
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
          <TableCell colSpan={5} className="h-px bg-surface-deep p-0" />
        </TableRow>
      )}
    </>
  );
}

// ── ProductTable ──────────────────────────────────────────────────────────────

function ProductTable({
  customer,
}: {
  customer: Customer;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState<"all" | "overrides">("all");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const setPrice = useSetCustomerPrice();
  const deletePrice = useDeleteCustomerPrice();
  const onError = useCallback((e: Error) => toast.error(e.message), []);

  function resetListPosition() {
    setPage(1);
    setExpandedProductId(null);
  }

  const { data: pageData } = useCustomerProductPricesPage(customer.id, {
    page,
    pageSize,
    search: search || undefined,
    filters: {
      category: catFilter === "all" ? undefined : catFilter,
      overridesOnly: modeFilter === "overrides" ? "true" : undefined,
    },
  });

  const priceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of pageData?.data ?? []) {
      if (row.customerPrice != null) {
        m.set(`${customer.id}:${row.id}`, fmt(row.customerPrice));
      }
    }
    return m;
  }, [pageData, customer.id]);

  const categories = pageData?.allCategories ?? [];

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
      deletePrice.mutate({ customerId: customer.id, productId }, { onError });
      return;
    }
    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 0) return;
    setPrice.mutate({ customerId: customer.id, productId, pricePerLb: v.toFixed(2) }, { onError });
  }

  function handleCommitVendor(productId: string, supplierId: string, rawValue: string) {
    if (!rawValue.trim()) {
      deletePrice.mutate(
        { customerId: customer.id, productId, supplierId },
        { onError },
      );
      return;
    }
    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 0) return;
    setPrice.mutate(
      { customerId: customer.id, productId, supplierId, pricePerLb: v.toFixed(2) },
      { onError },
    );
  }

  function handleResetVendor(productId: string, supplierId: string) {
    deletePrice.mutate(
      { customerId: customer.id, productId, supplierId },
      { onError },
    );
  }

  return (
    <Card className="gap-0 p-0 rounded-[10px] overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-border-default bg-divider/40">
        <InputGroup className="flex-none w-70 min-w-50">
          <InputGroupAddon align="inline-start">
            <Search size={14} />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              resetListPosition();
            }}
            placeholder="Search product or SKU…"
            className="text-[13px]"
          />
        </InputGroup>

        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={catFilter}
          onValueChange={v => {
            if (!v) return;
            setCatFilter(v);
            resetListPosition();
          }}
        >
          <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
          {categories.map(c => (
            <ToggleGroupItem key={c} value={c} size="sm">{c}</ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={modeFilter}
          onValueChange={v => {
            if (!v) return;
            setModeFilter(v as "all" | "overrides");
            resetListPosition();
          }}
        >
          <ToggleGroupItem value="all" size="sm">All products</ToggleGroupItem>
          <ToggleGroupItem value="overrides" size="sm">Customer prices</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex-1" />
        <span className="text-[12px] text-subtle">{pageData?.total ?? 0} products</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {(
              [
                ["Product", "40%", "text-left"],
                ["Cost", "120px", "text-right"],
                ["Price", "210px", "text-left"],
                ["Margin", "110px", "text-right"],
                ["", "120px", "text-center"],
              ] as const
            ).map(([label, w, align], i) => (
              <TableHead
                key={i}
                className={cn(
                  align,
                  "text-[11px] font-medium text-subtle uppercase tracking-[0.04em] bg-divider/40 px-4 py-2.5 h-auto",
                )}
                style={{ width: w }}
              >
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-16 text-center text-[13px] text-subtle">
                No products match.
              </TableCell>
            </TableRow>
          )}
          {grouped.map(([cat, prods], gi) => (
            <React.Fragment key={cat}>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className={cn(
                    "bg-divider/40 px-4 py-3 pb-1.5 text-[11px] font-semibold text-subtle uppercase tracking-widest",
                    gi > 0 && "border-t border-border-default",
                  )}
                >
                  {cat}
                  <span className="text-subtle/60 ml-2 font-medium">{prods.length}</span>
                </TableCell>
              </TableRow>
              {prods.map(prod => (
                <ProductRow
                  key={`${prod.id}:${priceMap.get(`${customer.id}:${prod.id}`) ?? ""}`}
                  prod={prod}
                  customer={customer}
                  priceMap={priceMap}
                  onCommit={handleCommit}
                  onReset={() =>
                    deletePrice.mutate(
                      { customerId: customer.id, productId: prod.id },
                      { onError },
                    )
                  }
                  deleting={
                    deletePrice.isPending &&
                    deletePrice.variables?.productId === prod.id &&
                    deletePrice.variables?.customerId === customer.id
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
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PriceChartClient() {
  const { data, isLoading, error } = usePriceChart();
  const updateFuelSurcharge = useUpdateCustomerFuelSurcharge();
  const applyMarkup = useApplyMarkupToCustomer();
  const onError = useCallback((e: Error) => toast.error(e.message), []);

  const customers = useMemo(() => data?.customers ?? [], [data]);
  const products = useMemo(() => data?.products ?? [], [data]);
  const prices = useMemo(() => data?.prices ?? [], [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markup, setMarkup] = useState(7);

  const effectiveSelected = selectedId ?? customers[0]?.id ?? null;
  const customer = customers.find(c => c.id === effectiveSelected) ?? null;

  if (isLoading) return <PageLoading message="Loading price chart…" />;
  if (error) return <PageError message={(error as Error).message} />;
  if (!customer) {
    return (
      <p className="py-16 text-center text-[13px] text-subtle">
        No customers yet. Add a customer to get started.
      </p>
    );
  }

  return (
    <div className="flex gap-4 items-start">
      <CustomerList
        customers={customers}
        prices={prices}
        selected={effectiveSelected}
        onSelect={id => setSelectedId(id)}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-3.5">
        <CustomerCard
          customer={customer}
          prices={prices}
          allProducts={products}
          markup={markup}
          onMarkupChange={setMarkup}
          onApplyMarkup={() =>
            applyMarkup.mutate({ customerId: customer.id, markupPercent: markup }, { onError })
          }
          applyingMarkup={
            applyMarkup.isPending && applyMarkup.variables?.customerId === customer.id
          }
        />

        <FuelCard
          key={`fuel:${customer.id}`}
          customer={customer}
          onSave={amount =>
            updateFuelSurcharge.mutate(
              { customerId: customer.id, fuelSurchargeAmount: amount },
              {
                onError,
                onSuccess: () =>
                  toast.success(
                    amount ? `Fuel surcharge set to $${amount}` : "Fuel surcharge waived",
                  ),
              },
            )
          }
          saving={updateFuelSurcharge.isPending}
        />

        <ProductTable
          key={`products:${customer.id}`}
          customer={customer}
        />
      </div>
    </div>
  );
}
