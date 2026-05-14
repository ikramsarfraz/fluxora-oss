"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { rememberInventoryView } from "../utils/view-preference";

/**
 * Items / Lots segmented toggle for the Inventory hub.
 * Spec: padding 4px, bg --line-2, radius 8px; active tab white + shadow.
 * Inventory items and lots are two cardinalities of one dataset —
 * the toggle communicates "different lens" not "different sub-page."
 */
export function InventoryViewToggle({
  itemsCount,
  lotsCount,
}: {
  itemsCount?: number;
  lotsCount?: number;
}) {
  const pathname = usePathname() ?? "";
  const view: "items" | "lots" = pathname.startsWith("/inventory/lots") ? "lots" : "items";

  // Persist the current view so `/inventory` returns the user here next time.
  // Effect runs on mount + whenever the view changes (e.g. clicked the other tab).
  useEffect(() => {
    rememberInventoryView(view);
  }, [view]);

  const hint =
    view === "items"
      ? "Each row is a physical unit with its own barcode and lot."
      : "Each row is a supplier receipt batch — drill in for write-offs, reversals, source receipts.";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="inline-flex gap-1 rounded-lg bg-stone-line2 p-1">
        <ToggleTab
          href="/inventory/items"
          icon={Box}
          label="On-hand items"
          count={itemsCount}
          active={view === "items"}
        />
        <ToggleTab
          href="/inventory/lots"
          icon={Layers}
          label="Lots"
          count={lotsCount}
          active={view === "lots"}
        />
      </div>
      <span className="text-[12px] text-stone-muted">{hint}</span>
    </div>
  );
}

function ToggleTab({
  href,
  icon: Icon,
  label,
  count,
  active,
}: {
  href: string;
  icon: typeof Box;
  label: string;
  count: number | undefined;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-stone-surface text-stone-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          : "text-stone-ink2 hover:text-stone-ink",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-[14px] shrink-0" strokeWidth={1.8} />
      <span>{label}</span>
      {count != null ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[11px] font-medium",
            active ? "bg-primary/10 text-primary" : "bg-stone-line2 text-stone-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
