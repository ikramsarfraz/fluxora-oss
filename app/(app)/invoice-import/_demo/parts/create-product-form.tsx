"use client";

import { Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useDemo } from "../state";
import type { LineItem, NewProductDraft, Unit } from "../types";

const UNITS: Unit[] = ["each", "box", "case", "lb", "kg"];

const CATEGORY_OPTIONS = [
  "Hardware",
  "Drive components",
  "Consumables",
  "Electrical",
  "Tooling",
  "Safety",
  "Uncategorized",
];

export function CreateProductForm({ line }: { line: LineItem }) {
  const { dispatch } = useDemo();

  const draft: NewProductDraft = line.newProductDraft ?? {
    name: line.description,
    sku: "",
    category: "Uncategorized",
    unit: "each",
    cost: line.unitCost ?? 0,
  };

  function patch(p: Partial<NewProductDraft>) {
    dispatch({ type: "UPDATE_DRAFT", lineId: line.id, patch: p });
  }

  function cancel() {
    dispatch({
      type: "UPDATE_LINE",
      lineId: line.id,
      patch: {
        newProductDraft: undefined,
        matchState: line.suggestions.length > 0 ? "suggested" : "unmatched",
      },
    });
  }

  function create() {
    dispatch({ type: "CREATE_PRODUCT", lineId: line.id, draft });
  }

  return (
    <div className="mt-1 rounded-md border border-forest-mid/30 bg-forest-tint/30 p-3">
      <div className="flex items-center gap-2 pb-2">
        <Sparkles className="size-3 text-forest-mid" />
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-forest">
          New product from this line
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={cancel}
          aria-label="Cancel"
          className="ml-auto"
        >
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1.4fr_1fr]">
        <FieldRow label="Name">
          <Input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="h-8"
          />
        </FieldRow>
        <FieldRow label="SKU">
          <Input
            value={draft.sku}
            onChange={(e) => patch({ sku: e.target.value.toUpperCase() })}
            className="h-8 font-mono text-[12px]"
            data-mono
          />
        </FieldRow>
        <FieldRow label="Category">
          <Select value={draft.category} onValueChange={(v) => patch({ category: v })}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Unit">
            <Select value={draft.unit} onValueChange={(v) => patch({ unit: v as Unit })}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Cost">
            <Input
              type="number"
              step="0.01"
              value={draft.cost}
              onChange={(e) => patch({ cost: Number(e.target.value) || 0 })}
              className="h-8 text-right tabular-nums"
            />
          </FieldRow>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={cancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          data-reel={`line-${line.id}-create`}
          onClick={create}
          disabled={!draft.name.trim() || !draft.sku.trim()}
        >
          <Plus className="size-3" />
          Create product
        </Button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.06em] text-subtle">
        {label}
      </label>
      {children}
    </div>
  );
}
