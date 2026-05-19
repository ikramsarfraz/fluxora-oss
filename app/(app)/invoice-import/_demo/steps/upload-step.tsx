"use client";

import { useRef, useState } from "react";
import { ArrowLeft, FileText, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

import {
  INITIAL_FILE,
  SECONDARY_FILE,
  formatBytes,
} from "../mock-data";
import { useDemo } from "../state";
import type { UploadedFile } from "../types";

const PRESETS: UploadedFile[] = [INITIAL_FILE, SECONDARY_FILE];

export function UploadStep() {
  const { state, dispatch } = useDemo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function appendPreset() {
    const next = PRESETS.find((p) => !state.files.some((f) => f.id === p.id));
    if (!next) return;
    dispatch({ type: "ADD_FILES", files: [next] });
  }

  function handleBrowse(files: FileList | null) {
    if (!files || files.length === 0) {
      appendPreset();
      return;
    }
    // Demo: convert real file selections into our mock representation
    const next: UploadedFile[] = Array.from(files).map((f, i) => ({
      id: `file_user_${Date.now()}_${i}`,
      filename: f.name,
      sizeBytes: f.size || 180_000,
      pages: Math.max(1, Math.round((f.size || 180_000) / 95_000)),
      stage: "queued",
      progress: 0,
    }));
    dispatch({ type: "ADD_FILES", files: next });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleBrowse(e.dataTransfer.files);
  }

  function start() {
    if (state.files.length === 0) {
      // Seed with the primary file so the demo can advance
      dispatch({ type: "ADD_FILES", files: [INITIAL_FILE] });
    }
    dispatch({ type: "SET_STEP", step: "scanning" });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Import invoice"
        description="Drop a supplier invoice PDF. Multiple files import in parallel."
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "SET_STEP", step: "inventory" })}
        >
          <ArrowLeft className="size-3.5" />
          Back to inventory
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <button
            type="button"
            data-reel="dropzone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "group relative flex flex-col items-center justify-center gap-3",
              "rounded-lg border-2 border-dashed bg-card-warm/60 px-6 py-14 text-center",
              "transition-colors",
              dragging
                ? "border-forest-mid bg-forest-tint/40"
                : "border-border-default hover:border-forest-mid/60 hover:bg-card-warm",
            )}
          >
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                "border border-border-default bg-card",
                "transition-colors",
                dragging && "border-forest-mid bg-forest-tint",
              )}
            >
              <UploadCloud className="size-5 text-forest-mid" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-ink">
                <span className="font-medium">Drop PDFs here</span>{" "}
                <span className="text-subtle">or click to browse</span>
              </div>
              <div className="text-xs text-subtle">
                PDF up to 10 MB. Multiple files supported.
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => handleBrowse(e.target.files)}
            />
          </button>

          {state.files.length > 0 && (
            <div className="rounded-md border border-border-default bg-card">
              <div className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
                <div className="text-xs font-medium uppercase tracking-[0.06em] text-subtle">
                  Files to import ({state.files.length})
                </div>
                <div className="text-xs text-subtle">
                  {formatBytes(state.files.reduce((s, f) => s + f.sizeBytes, 0))} total
                </div>
              </div>
              <ul className="divide-y divide-border-soft">
                {state.files.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border-default bg-card-warm">
                      <FileText className="size-3.5 text-forest-mid" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink">{f.filename}</div>
                      <div className="text-xs text-subtle tabular-nums">
                        {formatBytes(f.sizeBytes)} · {f.pages} page{f.pages === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        dispatch({ type: "REMOVE_FILE", fileId: f.id })
                      }
                      aria-label={`Remove ${f.filename}`}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "SET_STEP", step: "inventory" })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-reel="start-import"
              onClick={start}
              disabled={state.files.length === 0}
            >
              Start import
            </Button>
          </div>
        </div>

        <aside className="rounded-md border border-border-default bg-card-warm/70 p-4 text-sm text-ink-warm">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            What happens next
          </div>
          <ol className="mt-3 flex flex-col gap-3">
            <StepBullet
              n={1}
              title="Scan & extract"
              detail="Header, line items, totals, and dates are pulled from the PDF."
            />
            <StepBullet
              n={2}
              title="Match products"
              detail="Lines are matched to your catalog by SKU, name, and prior aliases."
            />
            <StepBullet
              n={3}
              title="Review & save"
              detail="Resolve any issues; products and stock update on save."
            />
          </ol>
        </aside>
      </div>
    </div>
  );
}

function StepBullet({ n, title, detail }: { n: number; title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-default bg-card font-mono text-[10px] text-ink-warm">
        {n}
      </span>
      <div>
        <div className="font-medium text-ink">{title}</div>
        <div className="text-xs text-subtle">{detail}</div>
      </div>
    </li>
  );
}
