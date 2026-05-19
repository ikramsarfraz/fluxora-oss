"use client";

import { Search } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";

import { REVIEW_COLORS } from "./tokens";
import type { ProductLookup } from "./map-pipeline-to-review-data";

/**
 * Autocomplete picker for a line's product. Reuses the search-icon-prefixed
 * input look from the original static ProductPicker but adds catalog
 * filtering. Click the trigger to open, type to filter, pick to confirm.
 */
export function ProductPicker({
  products,
  selectedId,
  placeholder,
  onValueChange,
}: {
  products: ProductLookup[];
  selectedId: string | null;
  placeholder: string;
  onValueChange: (product: ProductLookup | null) => void;
}) {
  const selected = selectedId
    ? products.find(p => p.id === selectedId) ?? null
    : null;

  return (
    <div className="relative min-w-[240px] flex-[1_1_280px]">
      <Combobox
        items={products}
        itemToStringValue={(p: ProductLookup) => p.name}
        value={selected}
        onValueChange={onValueChange}
      >
        <ComboboxTrigger
          render={
            <Button
              type="button"
              variant="outline"
              onClick={e => e.stopPropagation()}
              className="h-8 w-full justify-start pl-8 pr-2.5 text-[12.5px] font-normal text-ink shadow-none"
            >
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-[14px] -translate-y-1/2"
                strokeWidth={1.6}
                style={{ color: REVIEW_COLORS.mutedSoft }}
              />
              <ComboboxValue>
                {selected ? selected.name : placeholder}
              </ComboboxValue>
            </Button>
          }
        />
        <ComboboxContent>
          <ComboboxInput showTrigger={false} placeholder="Search by name or SKU…" />
          <ComboboxEmpty>No products found.</ComboboxEmpty>
          <ComboboxList>
            {(p: ProductLookup) => (
              <ComboboxItem key={p.id} value={p}>
                <div className="flex w-full items-center justify-between gap-2.5">
                  <span className="truncate text-[13px] text-ink">{p.name}</span>
                  {p.sku ? (
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: REVIEW_COLORS.mutedSoft }}
                    >
                      {p.sku}
                    </span>
                  ) : null}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
