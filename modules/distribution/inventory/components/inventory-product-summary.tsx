"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp } from "lucide-react";

import { useInventoryProductSummary } from "../hooks/use-inventory";
import { MonoText } from "@/components/listing-page";
import { cn } from "@/lib/utils";
import { formatWeightLbs } from "../utils/insights";

type SortKey = "name" | "totalCases" | "totalWeightLbs" | "itemCount";
type SortDirection = "asc" | "desc";

const HEADERS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Product" },
  { key: "totalCases", label: "Cases", align: "right" },
  // Generic "Quantity" label — the cell renders weight for weight-family
  // products and count for non-weight products, each with the right
  // abbreviation. Sort still operates on the weight column (zero for
  // non-weight rows, which clusters them).
  { key: "totalWeightLbs", label: "Quantity", align: "right" },
  { key: "itemCount", label: "Items", align: "right" },
];

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-40" />;
  if (direction === "asc") return <ChevronUp className="size-3" />;
  return <ChevronDown className="size-3" />;
}

export function InventoryProductSummary() {
  const { data, isLoading, error } = useInventoryProductSummary();
  const [sort, setSort] = useState<SortKey>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [collapsed, setCollapsed] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => {
      let cmp = 0;
      if (sort === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sort === "totalCases") {
        cmp = a.totalCases - b.totalCases;
      } else if (sort === "itemCount") {
        cmp = a.itemCount - b.itemCount;
      } else if (sort === "totalWeightLbs") {
        cmp = Number(a.totalWeightLbs) - Number(b.totalWeightLbs);
      }
      return direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, sort, direction]);

  function handleSort(key: SortKey) {
    if (sort === key) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setDirection(key === "name" ? "asc" : "desc");
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-border-default bg-card px-4 py-3 text-[13px] text-subtle">
        Couldn’t load product totals.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-border-default bg-card">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-surface-deep/40"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="size-3.5 text-subtle" />
          ) : (
            <ChevronDown className="size-3.5 text-subtle" />
          )}
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-subtle">
            On-hand by product
          </span>
          {!isLoading && data ? (
            <span className="text-[11px] text-subtle">· {data.length}</span>
          ) : null}
        </div>
      </button>

      {!collapsed ? (
        <div className="border-t border-border-default">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-[13px] text-subtle">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-subtle">
              No products in stock.
            </div>
          ) : (
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border-default">
                    {HEADERS.map(h => (
                      <th
                        key={h.key}
                        className={cn(
                          "px-4 py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-subtle",
                          h.align === "right" ? "text-right" : "text-left",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(h.key)}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-ink",
                            h.align === "right" ? "ml-auto" : "",
                          )}
                        >
                          {h.label}
                          <SortIcon active={sort === h.key} direction={direction} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr
                      key={row.productId}
                      className="border-b border-border-default/60 last:border-b-0 hover:bg-surface-deep/30"
                    >
                      <td className="px-4 py-2 text-ink">
                        <div className="font-medium">{row.name}</div>
                        <div className="mt-0.5 text-[11px] text-subtle">
                          <MonoText>{row.sku}</MonoText>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <MonoText>{row.totalCases.toLocaleString()}</MonoText>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {/* Family-aware: weight products show "X.XX lb"
                            (or kg, oz); non-weight products show their
                            case count in the product's base UOM. */}
                        <MonoText>
                          {row.baseUnitFamily === "weight" ||
                          row.baseUnitFamily == null
                            ? `${formatWeightLbs(row.totalWeightLbs)} ${row.baseUnitAbbreviation ?? "lb"}`
                            : `${row.totalCases.toLocaleString()} ${row.baseUnitAbbreviation ?? "ea"}`}
                        </MonoText>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <MonoText>{row.itemCount.toLocaleString()}</MonoText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
