"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type { AiExtractionErrorCode } from "../services/ai-provider";

import SupplierInvoicesPage from "./supplier-invoices-page";
import { BulkImportSheet } from "./bulk-import-sheet";
import { BulkLandingLive } from "./bulk-landing/bulk-landing-live";
import { ParseErrorDialog } from "./bulk-landing/parse-error-dialog";
import type { BatchFile } from "./bulk-landing/types";
import { useBulkBatchView } from "./bulk-landing/use-bulk-batch-view";

type Tab = "inbox" | "bills";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "bills", label: "Bills" },
];

/**
 * Top-level shell for `/supplier-invoices` that owns the shared chrome —
 * page header, action buttons, and tab navigation — and slots one of two
 * tab bodies underneath based on the `?tab=` query param.
 *
 * Why this exists: previously there were three separate routes
 * (`/supplier-invoices`, `/supplier-invoices/bulk`, `/supplier-invoices/bulk-import`)
 * showing related data with different shells. Consolidating into one tabbed
 * page lets a reviewer triage the inbox (pending parses) and the bills
 * archive without context-switching across pages, and turns "Bulk import"
 * into a side-sheet affordance instead of a route navigation.
 *
 * The shell stays thin: each tab's data + interactions live in their own
 * components (`BulkLandingLive`, `SupplierInvoicesPage`). The shell just
 * picks one, owns the sheet/dialog open state, and syncs the tab to the
 * URL so deep-links + browser back/forward work.
 */
export function SupplierBillsShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab read from URL — `?tab=inbox` or `?tab=bills`. Anything else falls
  // back to Bills (the archive). New visitors landing on
  // `/supplier-invoices` get Bills, which matches the page's historical
  // behaviour; users coming from `/supplier-invoices/bulk` get redirected
  // here with `?tab=inbox` (see routes/bulk-page.tsx).
  const activeTab: Tab = searchParams.get("tab") === "inbox" ? "inbox" : "bills";

  const setTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "bills") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      router.replace(qs ? `/supplier-invoices?${qs}` : "/supplier-invoices", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  // ── Sheet + dialog state ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [parseErrorFile, setParseErrorFile] = useState<BatchFile | null>(null);

  const openSheet = useCallback(() => setSheetOpen(true), []);

  const handleParseErrorClick = useCallback((file: BatchFile) => {
    setParseErrorFile(file);
  }, []);

  const handleParseErrorReupload = useCallback(() => {
    setParseErrorFile(null);
    setSheetOpen(true);
  }, []);

  // ── Tab counts ──
  // Inbox count is the live pending-bulk-import row count. We don't fetch
  // the bills count here because the bills query is paginated and the
  // shell-level "total" would be a duplicate request — the table itself
  // shows the count in its pagination footer.
  const { view } = useBulkBatchView();
  const inboxCount = view?.summary.filesProcessed ?? null;

  // Cast error codes off the active file. BatchFile stores them as
  // `string[]` (the type module is presentation-layer); narrow to the
  // pipeline's enum at the boundary so the dialog can switch on a typed
  // value safely.
  const activeParseErrorCodes = useMemo<AiExtractionErrorCode[]>(
    () => (parseErrorFile?.parseErrorCodes ?? []) as AiExtractionErrorCode[],
    [parseErrorFile],
  );

  return (
    <>
      <div className="flex flex-col">
        {/* Shared header — title, subtitle, action buttons. Identical
            across both tabs so the page feels like one surface. */}
        <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h1 className="m-0 text-[22px] font-semibold leading-tight tracking-normal text-stone-ink">
              Supplier bills
            </h1>
            <p className="mt-1 mb-0 text-[13px] text-stone-muted">
              Inbox holds parsed PDFs awaiting your review. Bills are the
              posted invoices that have already moved inventory.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openSheet}
              className="gap-1.5 text-[13px]"
            >
              <Layers className="size-3.5" />
              Bulk import
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/supplier-invoices/new")}
              className="gap-1.5 border-stone-ink bg-stone-ink text-[13px] text-stone-surface hover:bg-stone-ink/90"
            >
              <Plus className="size-3.5" />
              Record bill
            </Button>
          </div>
        </div>

        {/* Tab strip — visually matches the savedViews pattern in
            ListingPage so users coming from other listings see the same
            interaction model. URL-synced via `?tab=` so deep-links work. */}
        <ToggleGroup
          type="single"
          value={activeTab}
          onValueChange={value => {
            if (value === "inbox" || value === "bills") setTab(value);
          }}
          className="mb-5 w-full justify-start rounded-none border-b border-stone-line"
          variant="default"
          size="sm"
        >
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            const count = t.id === "inbox" ? inboxCount : null;
            return (
              <ToggleGroupItem
                key={t.id}
                value={t.id}
                className={cn(
                  "-mb-px h-auto rounded-none border-b-2 border-transparent px-3.5 py-2.5 text-[13px] font-normal text-stone-muted hover:bg-transparent hover:text-stone-ink data-[state=on]:border-stone-ink data-[state=on]:bg-transparent data-[state=on]:font-semibold data-[state=on]:text-stone-ink",
                )}
              >
                {t.label}
                {count !== null ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-2 h-5 rounded-full px-1.5 text-[11px]",
                      isActive
                        ? "bg-stone-ink text-stone-surface"
                        : "bg-stone-line text-stone-muted",
                    )}
                  >
                    {count}
                  </Badge>
                ) : null}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        {/* Tab body. Each tab renders its own embedded variant — the inner
            components skip their own title/header so the shell's chrome
            isn't duplicated. */}
        {activeTab === "inbox" ? (
          <BulkLandingLive
            embedded
            onImportMore={openSheet}
            onParseErrorClick={handleParseErrorClick}
          />
        ) : (
          <SupplierInvoicesPage embedded />
        )}
      </div>

      <BulkImportSheet open={sheetOpen} onOpenChange={setSheetOpen} />

      <ParseErrorDialog
        file={parseErrorFile}
        parseErrorCodes={activeParseErrorCodes}
        onOpenChange={open => {
          if (!open) setParseErrorFile(null);
        }}
        onReupload={handleParseErrorReupload}
      />
    </>
  );
}
