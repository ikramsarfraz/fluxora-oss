"use client";

import { TriangleAlert } from "lucide-react";

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
import type { SupplierLookup } from "./map-pipeline-to-review-data";

/**
 * Autocomplete picker for the Supplier field on the Review screen. The
 * trigger reuses the warn-tinted treatment from the original static input so
 * "needs attention" rows stand out; the dropdown filters the catalog by name
 * client-side (cheap — the list is already cached).
 */
export function SupplierPicker({
  suppliers,
  value,
  /** Pipeline-resolved supplier id, used so the trigger reads "Selected" vs raw text. */
  selectedId,
  onValueChange,
  onTypedNameChange,
  needsAttention,
}: {
  suppliers: SupplierLookup[];
  /** Display text shown in the trigger when nothing is selected from the list. */
  value: string;
  selectedId: string | null;
  onValueChange: (supplier: SupplierLookup | null) => void;
  /** Called when the user types a name that doesn't match a catalog supplier. */
  onTypedNameChange?: (name: string) => void;
  needsAttention?: boolean;
}) {
  const selected = selectedId ? suppliers.find(s => s.id === selectedId) ?? null : null;

  return (
    <div className="relative">
      <Combobox
        items={suppliers}
        itemToStringValue={(s: SupplierLookup) => s.name}
        value={selected}
        onValueChange={(s: SupplierLookup | null) => {
          onValueChange(s);
          if (!s && onTypedNameChange) {
            // The user cleared the selection or typed something unmatched —
            // keep the raw text alive so the field doesn't flash empty.
            onTypedNameChange("");
          }
        }}
      >
        <ComboboxTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-[34px] w-full justify-start px-3 text-[13px] font-normal text-stone-ink shadow-none"
              style={
                needsAttention
                  ? {
                      borderColor: REVIEW_COLORS.warn,
                      background: "#fffdf8",
                    }
                  : undefined
              }
            >
              <ComboboxValue>
                {selected
                  ? selected.name
                  : value
                    ? value
                    : "Search suppliers…"}
              </ComboboxValue>
            </Button>
          }
        />
        <ComboboxContent>
          <ComboboxInput
            showTrigger={false}
            placeholder="Search by name…"
            onChange={e => onTypedNameChange?.(e.currentTarget.value)}
          />
          <ComboboxEmpty>No suppliers found.</ComboboxEmpty>
          <ComboboxList>
            {(s: SupplierLookup) => (
              <ComboboxItem key={s.id} value={s}>
                <span className="text-[13px] text-stone-ink">{s.name}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {needsAttention ? (
        <TriangleAlert
          className="pointer-events-none absolute right-9 top-1/2 size-[14px] -translate-y-1/2"
          strokeWidth={1.6}
          style={{ color: REVIEW_COLORS.warn }}
        />
      ) : null}
    </div>
  );
}
