"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CornerDownLeft,
  Package,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useDemo } from "../state";
import type { LineItem, Product, ProductSuggestion } from "../types";

type Props = {
  line: LineItem;
};

export function ProductPicker({ line }: Props) {
  const { state, dispatch, productById } = useDemo();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matched = productById(line.matchedProductId);
  const suggestions = line.suggestions;

  const results = useMemo<Product[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.products.slice(0, 8);
    return state.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [state.products, query]);

  function pickProduct(productId: string) {
    if (line.matchState === "suggested") {
      dispatch({ type: "CONFIRM_SUGGESTION", lineId: line.id, productId });
    } else {
      dispatch({
        type: "SET_LINE_MATCH",
        lineId: line.id,
        productId,
        matchState: "auto-matched",
      });
    }
    setOpen(false);
    setQuery("");
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-reel={`line-${line.id}-picker`}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
            "hover:bg-surface focus-visible:bg-surface focus-visible:outline-none",
          )}
        >
          <PickerTriggerContent line={line} matched={matched} />
          <ChevronDown className="ml-auto size-3 shrink-0 text-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[380px] p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative border-b border-border-soft">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name or SKU"
            className="h-9 rounded-none border-0 bg-transparent pl-8 text-sm shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>

        {suggestions.length > 0 && query.trim() === "" && (
          <div className="border-b border-border-soft py-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] text-subtle">
              <Sparkles className="size-3 text-forest-mid/70" />
              Top suggestions
            </div>
            {suggestions.map((s) => (
              <SuggestionRow
                key={s.productId}
                suggestion={s}
                onSelect={() => pickProduct(s.productId)}
              />
            ))}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-subtle">
              No products match {`"${query}"`}.
            </div>
          )}
          {results.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => pickProduct(p.id)}
              className="flex items-start gap-2 px-3 py-2"
            >
              <Package className="mt-0.5 size-3.5 shrink-0 text-subtle" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-ink">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-subtle">
                  <span className="font-mono" data-mono>
                    {p.sku}
                  </span>
                  <span>·</span>
                  <span>{p.category}</span>
                </div>
              </div>
              {line.matchedProductId === p.id && (
                <Check className="mt-1 size-3.5 text-forest-mid" />
              )}
            </DropdownMenuItem>
          ))}
        </div>

        <div className="border-t border-border-soft p-1">
          <DropdownMenuItem
            onSelect={() => {
              dispatch({
                type: "UPDATE_LINE",
                lineId: line.id,
                patch: {
                  matchState: "unmatched",
                  matchedProductId: null,
                  newProductDraft: line.newProductDraft ?? {
                    name: line.description,
                    sku: suggestSku(line.description),
                    category: "Uncategorized",
                    unit: "each",
                    cost: line.unitCost ?? 0,
                  },
                },
              });
              setOpen(false);
            }}
            className="gap-2"
          >
            <Plus className="size-3.5" />
            <span>Create new product from this line</span>
            <CornerDownLeft className="ml-auto size-3 text-subtle" />
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PickerTriggerContent({
  line,
  matched,
}: {
  line: LineItem;
  matched: Product | undefined;
}) {
  if (matched) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink">
            {matched.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-subtle">
          <span className="font-mono" data-mono>
            {matched.sku}
          </span>
          {line.aliasAdded && (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest-tint px-1.5 text-[9px] font-medium text-forest">
              <Sparkles className="size-2.5" />
              alias added
            </span>
          )}
          {!line.aliasAdded && line.rawMatchHint && (
            <span className="text-[10px] text-subtle">
              · matched via alias
            </span>
          )}
        </div>
      </div>
    );
  }

  if (line.matchState === "suggested" && line.suggestions[0]) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-ink-warm">
          {line.description}
        </span>
        <span className="text-[10.5px] text-warning-fg">
          {line.suggestions.length} suggestion
          {line.suggestions.length === 1 ? "" : "s"} — confirm or pick another
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-danger-fg" />
        <span className="text-sm text-danger-fg">No match</span>
      </span>
      <span className="truncate text-[10.5px] text-subtle">
        {line.description}
      </span>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onSelect,
}: {
  suggestion: ProductSuggestion;
  onSelect: () => void;
}) {
  const { productById } = useDemo();
  const product = productById(suggestion.productId);
  if (!product) return null;
  const pct = Math.round(suggestion.score * 100);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-forest-tint/40"
    >
      <Package className="mt-0.5 size-3.5 shrink-0 text-forest-mid" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{product.name}</span>
          <span className="text-[10px] text-subtle">{suggestion.reason}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-subtle">
          <span className="font-mono" data-mono>
            {product.sku}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[10.5px] tabular-nums text-ink-warm">{pct}%</span>
        <span
          className="h-1 w-10 rounded-full bg-border-soft"
          aria-hidden
        >
          <span
            className={cn(
              "block h-full rounded-full",
              pct >= 80
                ? "bg-success-fg"
                : pct >= 60
                  ? "bg-warning-fg"
                  : "bg-muted",
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>
    </button>
  );
}

function suggestSku(description: string): string {
  const slug = description
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s.slice(0, 3))
    .join("-");
  return slug || "NEW-SKU";
}
