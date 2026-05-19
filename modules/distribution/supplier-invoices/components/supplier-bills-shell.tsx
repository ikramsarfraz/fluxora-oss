"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Inbox, Layers, Plus, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AiExtractionErrorCode } from "../services/ai-provider";

import SupplierInvoicesPage from "./supplier-invoices-page";
import { BulkLandingLive } from "./bulk-landing/bulk-landing-live";
import { ParseErrorDialog } from "./bulk-landing/parse-error-dialog";
import type { BatchFile } from "./bulk-landing/types";
import { useBulkBatchView } from "./bulk-landing/use-bulk-batch-view";

type Tab = "inbox" | "bills";

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "inbox", label: "Imports", icon: Inbox },
];

/**
 * Top-level shell for `/supplier-invoices` that owns the shared chrome —
 * page header, action buttons, and tab navigation — and slots one of two
 * tab bodies underneath based on the `?tab=` query param.
 *
 * Why this exists: previously there were three separate routes
 * (`/supplier-invoices`, `/supplier-invoices/bulk`, `/supplier-invoices/bulk-import`)
 * showing related data with different shells. Consolidating into one tabbed
 * page lets a reviewer triage imports (pending scans) and the bills archive
 * without context-switching across pages. The "Bulk import" header button
 * now triggers an inline dropzone embedded in the Imports tab — clicking it
 * from any tab switches to Imports and opens the native file picker, so
 * there's no separate sheet/drawer to dismiss.
 *
 * The shell stays thin: each tab's data + interactions live in their own
 * components (`BulkLandingLive`, `SupplierInvoicesPage`). The shell owns
 * the parse-error dialog state plus a one-shot `pickFilesIntent` flag that
 * routes the header button click through the dropzone in BulkLandingLive.
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

  // ── Dialog + dropzone-trigger state ──
  // `pickFilesIntent` is a one-shot flag the Imports tab consumes on mount
  // to open the inline dropzone's file picker. We use a flag (rather than a
  // ref) so it survives the tab-switch render: when the user clicks "Bulk
  // import" from the Bills tab, the InlineDropzone hasn't mounted yet —
  // setting the flag here AND switching tabs lets the dropzone fire its
  // picker the moment it renders, then call back to clear the flag.
  const [parseErrorFile, setParseErrorFile] = useState<BatchFile | null>(null);
  const [pickFilesIntent, setPickFilesIntent] = useState(false);

  const triggerBulkImport = useCallback(() => {
    if (activeTab !== "inbox") setTab("inbox");
    setPickFilesIntent(true);
  }, [activeTab, setTab]);

  const handleParseErrorClick = useCallback((file: BatchFile) => {
    setParseErrorFile(file);
  }, []);

  const handleParseErrorReupload = useCallback(() => {
    setParseErrorFile(null);
    triggerBulkImport();
  }, [triggerBulkImport]);

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
            <h1 className="m-0 text-[22px] font-medium leading-tight tracking-normal text-stone-ink">
              Supplier bills
            </h1>
            <p className="mt-1 mb-0 text-[13px] text-stone-muted">
              Imports holds parsed PDFs awaiting your review. Bills are the
              posted invoices that have already moved inventory.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerBulkImport}
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

        {/* Tab strip — matches the segmented pill toggle used by the
            Inventory hub (InventoryViewToggle): line2-tinted track, active
            tab as a white surface pill with subtle shadow. URL-synced via
            `?tab=` so deep-links work. router.replace keeps tab switches
            out of the browser back stack. */}
        <div className="mb-5 inline-flex gap-1 self-start rounded-lg bg-stone-line2 p-1">
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            const count = t.id === "inbox" ? inboxCount : null;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-stone-surface text-stone-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "text-stone-ink2 hover:text-stone-ink",
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
                        : "bg-stone-line2 text-stone-muted",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tab body. Each tab renders its own embedded variant — the inner
            components skip their own title/header so the shell's chrome
            isn't duplicated. */}
        {activeTab === "inbox" ? (
          <BulkLandingLive
            embedded
            pickFilesIntent={pickFilesIntent}
            onPickFilesIntentHandled={() => setPickFilesIntent(false)}
            onParseErrorClick={handleParseErrorClick}
          />
        ) : (
          <SupplierInvoicesPage embedded />
        )}
      </div>

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
