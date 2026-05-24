"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { checkBillPdfAvailability } from "../actions/check-bill-pdf-availability";
import type { BillPdfSource } from "../actions/check-bill-pdf-availability";

/**
 * Inline multi-file PDF viewer on the supplier-invoice detail page.
 *
 * Loads every PDF tied to this bill — manual uploads via
 * supplier_invoice_attachments AND the bulk-import original via
 * bulk_import_files — and renders a segmented picker above the iframe so
 * the user can flip between them. Default selection is the most recent
 * file, matching the prior single-file behaviour.
 *
 * Iframe pulls bytes from a same-origin Next route per source kind:
 *   - manual upload → /api/supplier-invoices/[id]/attachments/[fileId]
 *   - bulk-import   → /api/supplier-invoices/[id]/bulk-import/[bulkId]
 *
 * Both routes enforce tenant + view_supplier_invoice permission +
 * verify the file is actually tied to this bill, so the URL can't be
 * used to peek at other tenants' PDFs even if the id were guessed.
 *
 * Returns null when no PDF is on file so the section disappears
 * entirely rather than rendering an empty card.
 */
export function SupplierInvoicePdfPreviewCard({
  supplierInvoiceId,
}: {
  supplierInvoiceId: string;
}) {
  const [sources, setSources] = useState<BillPdfSource[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkBillPdfAvailability(supplierInvoiceId)
      .then(r => {
        if (cancelled) return;
        setSources(r.sources);
        // Default to the most recent file (sources arrive newest-first).
        setActiveId(r.sources[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierInvoiceId]);

  // Mid-load: render nothing rather than a flashing empty card. The
  // server fetch is sub-200ms in practice.
  if (sources === null) return null;
  if (sources.length === 0) return null;

  const active = sources.find(s => s.id === activeId) ?? sources[0];
  const href = buildHref(supplierInvoiceId, active);
  const activeIndex = sources.findIndex(s => s.id === active.id);
  const hasMultiple = sources.length > 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Source PDF
            {hasMultiple ? (
              <span className="text-[12px] font-normal text-subtle">
                {activeIndex + 1} of {sources.length}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription className="truncate font-mono">
            {active.filename}
            {active.source === "bulk-import" ? (
              <span className="ml-1.5 text-[11px] text-subtle/70 font-sans">
                · original
              </span>
            ) : null}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Open in new tab
          </a>
        </Button>
      </CardHeader>

      {hasMultiple ? (
        <div className="flex items-center gap-2 px-6 -mt-2 mb-3 flex-wrap">
          {sources.map(s => {
            const isActive = s.id === active.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={
                  isActive
                    ? "rounded border border-border-default bg-card px-2.5 py-1 text-[12px] font-medium text-ink shadow-xs"
                    : "rounded px-2.5 py-1 text-[12px] font-normal text-subtle hover:bg-divider hover:text-ink"
                }
                title={s.filename}
              >
                <span className="max-w-[200px] inline-block truncate align-bottom">
                  {s.filename}
                </span>
                {s.source === "bulk-import" ? (
                  <span className="ml-1 text-[10.5px] text-subtle">
                    · original
                  </span>
                ) : null}
              </button>
            );
          })}
          {/* Keyboard-friendly prev/next when > 2 files. The text buttons
              above remain the primary affordance; these are quick paging. */}
          {sources.length > 2 ? (
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Previous PDF"
                disabled={activeIndex <= 0}
                onClick={() => {
                  const prev = sources[activeIndex - 1];
                  if (prev) setActiveId(prev.id);
                }}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Next PDF"
                disabled={activeIndex >= sources.length - 1}
                onClick={() => {
                  const next = sources[activeIndex + 1];
                  if (next) setActiveId(next.id);
                }}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <CardContent>
        <iframe
          // Key forces a fresh iframe element on src change so browsers
          // that cache the rendered PDF don't show the previous file.
          key={active.id}
          src={`${href}#view=FitH`}
          title={active.filename}
          className="h-[640px] w-full rounded-md border border-border-default bg-divider"
        />
      </CardContent>
    </Card>
  );
}

function buildHref(supplierInvoiceId: string, src: BillPdfSource): string {
  // Strip the `file:` / `bulk:` prefix added by checkBillPdfAvailability.
  const [kind, rawId] = src.id.split(":", 2);
  if (kind === "file") {
    return `/api/supplier-invoices/${supplierInvoiceId}/attachments/${rawId}`;
  }
  return `/api/supplier-invoices/${supplierInvoiceId}/bulk-import/${rawId}`;
}
