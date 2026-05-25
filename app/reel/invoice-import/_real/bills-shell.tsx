"use client";

import { Inbox, Layers, Plus, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BillsArchive } from "./bills-archive";
import { BulkLanding } from "./bulk-landing";
import { useReel } from "./reel-state";
import type { Tab } from "./types";

// Reproduced from
// modules/distribution/supplier-invoices/components/supplier-bills-shell.tsx
// JSX + classes verbatim. Reel state replaces useRouter/useSearchParams.

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "inbox", label: "Imports", icon: Inbox },
];

export function BillsShell() {
  const { state, dispatch } = useReel();
  const activeTab = state.activeTab;

  const inboxCount =
    state.view.files.length > 0 ? state.view.summary.filesProcessed : null;

  function triggerBulkImport() {
    dispatch({ type: "SET_TAB", tab: "inbox" });
    // If the imports tab is empty, the dropzone already shows. The reel's
    // autopilot will dispatch DROP_FILE next.
  }

  function setTab(next: Tab) {
    dispatch({ type: "SET_TAB", tab: next });
  }

  return (
    <div className="flex flex-col">
      {/* Shared header — title, subtitle, action buttons. */}
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-medium leading-tight tracking-normal text-ink">
            Supplier bills
          </h1>
          <p className="mt-1 mb-0 text-[13px] text-subtle">
            Imports holds parsed PDFs awaiting your review. Bills are the
            posted invoices that have already moved inventory.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-reel="bulk-import"
            onClick={triggerBulkImport}
            className="gap-1.5 text-[13px]"
          >
            <Layers className="size-3.5" />
            Bulk import
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 border-forest-mid bg-forest-mid text-[13px] text-card-warm hover:bg-forest"
          >
            <Plus className="size-3.5" />
            Record bill
          </Button>
        </div>
      </div>

      {/* Tab strip — segmented pill toggle. */}
      <div className="mb-5 inline-flex gap-1 self-start rounded-lg bg-divider p-1">
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          const count = t.id === "inbox" ? inboxCount : null;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              data-reel={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-ink-warm hover:text-ink",
              )}
            >
              <Icon className="size-[14px] shrink-0" strokeWidth={1.8} />
              <span>{t.label}</span>
              {count != null ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-divider text-subtle",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      {activeTab === "inbox" ? <BulkLanding /> : <BillsArchive />}
    </div>
  );
}
