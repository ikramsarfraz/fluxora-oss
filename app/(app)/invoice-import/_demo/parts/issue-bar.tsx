"use client";

import { AlertTriangle, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { HeaderIssue, LineItem, LineIssue } from "../types";
import type { InvoiceIssueSummary } from "../lib/issues";

type Props = {
  summary: InvoiceIssueSummary;
  lines: LineItem[];
  onJump: (target: { kind: "header" } | { kind: "line"; lineId: string }) => void;
};

export function IssueBar({ summary, lines, onJump }: Props) {
  if (summary.errors === 0 && summary.warnings === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success-border bg-success-bg/70 px-3.5 py-2 text-sm text-success-fg">
        <span className="size-1.5 rounded-full bg-success-fg" aria-hidden />
        <span className="font-medium">All checks passed.</span>
        <span className="text-success-fg/80">Ready to save.</span>
      </div>
    );
  }

  const items: { type: "error" | "warning"; label: string; onClick: () => void }[] = [];

  for (const h of summary.headerIssues) {
    items.push({
      type: h.type,
      label: h.message,
      onClick: () => onJump({ kind: "header" }),
    });
  }
  for (const line of lines) {
    const issues = summary.byLineId.get(line.id) ?? [];
    for (const issue of issues) {
      items.push({
        type: issue.type,
        label: labelForLine(line, issue),
        onClick: () => onJump({ kind: "line", lineId: line.id }),
      });
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border px-3.5 py-2.5",
        summary.errors > 0
          ? "border-danger-border bg-danger-bg/40"
          : "border-warning-border bg-warning-bg/40",
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        {summary.errors > 0 ? (
          <CircleAlert className="size-3.5 text-danger-fg" />
        ) : (
          <AlertTriangle className="size-3.5 text-warning-fg" />
        )}
        <span className="font-medium text-ink">
          {summary.errors > 0
            ? `${summary.errors} error${summary.errors === 1 ? "" : "s"}`
            : ""}
          {summary.errors > 0 && summary.warnings > 0 ? ", " : ""}
          {summary.warnings > 0
            ? `${summary.warnings} warning${summary.warnings === 1 ? "" : "s"}`
            : ""}
        </span>
        <span className="text-xs text-subtle">
          {summary.errors > 0
            ? "Resolve errors to save."
            : "Warnings won't block save."}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 6).map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={it.onClick}
            className="inline-flex items-center gap-1 rounded-full border border-border-default bg-card px-2 py-0.5 text-[11px] text-ink-warm hover:bg-card-warm"
          >
            {it.type === "error" ? (
              <span className="size-1.5 rounded-full bg-danger-fg" aria-hidden />
            ) : (
              <span className="size-1.5 rounded-full bg-warning-fg" aria-hidden />
            )}
            {it.label}
          </button>
        ))}
        {items.length > 6 && (
          <Badge variant="outline">+{items.length - 6} more</Badge>
        )}
      </div>
    </div>
  );
}

function labelForLine(line: LineItem, issue: LineIssue): string {
  const short =
    line.description.length > 28
      ? `${line.description.slice(0, 28)}…`
      : line.description;
  return `${short} · ${issue.message}`;
}

export type { HeaderIssue, LineIssue };
