"use client";

import { Fragment } from "react";

import { cn } from "@/lib/utils";

type LegendEntry = {
  days: string;
  title: string;
  meaning: string;
};

const ENTRIES: ReadonlyArray<LegendEntry> = [
  {
    days: "0",
    title: "Due on receipt",
    meaning: "Payment is due on the invoice date. Common for cash-on-delivery suppliers.",
  },
  {
    days: "7",
    title: "Net 7",
    meaning: "Payment due one week after the invoice date — typical for weekly billing cycles.",
  },
  {
    days: "15",
    title: "Net 15",
    meaning: "Payment due 15 days after the invoice date.",
  },
  {
    days: "30",
    title: "Net 30",
    meaning: "Payment due 30 days after the invoice date. The standard B2B term.",
  },
  {
    days: "60",
    title: "Net 60",
    meaning: "Extended terms — payment due 60 days after the invoice date.",
  },
];

/**
 * Inline legend that explains the "payment terms (net days)" field. Rendered
 * on the add/edit supplier forms so first-time users can build a quick mental
 * model of how AP aging interprets the value.
 */
export function NetTermsLegend({ className }: { className?: string }) {
  return (
    <aside
      aria-label="How net payment terms work"
      className={cn(
        "mt-1 rounded-md border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed",
        className,
      )}
    >
      <p className="font-medium text-foreground">What does &ldquo;net days&rdquo; mean?</p>
      <p className="mt-1 text-muted-foreground">
        &ldquo;Net N&rdquo; means an invoice is due N days after its invoice date. For example,
        an invoice dated <span className="font-medium text-foreground">Mar&nbsp;1</span> with{" "}
        <span className="font-medium text-foreground">Net&nbsp;30</span> is due{" "}
        <span className="font-medium text-foreground">Mar&nbsp;31</span>.
      </p>
      <dl className="mt-2 grid grid-cols-[2rem_1fr] gap-x-3 gap-y-1">
        {ENTRIES.map(entry => (
          <Fragment key={entry.days}>
            <dt className="text-right font-mono font-medium text-foreground tabular-nums">
              {entry.days}
            </dt>
            <dd className="text-muted-foreground">
              <span className="text-foreground">{entry.title}</span>
              <span className="mx-1 text-muted-foreground/70">·</span>
              {entry.meaning}
            </dd>
          </Fragment>
        ))}
      </dl>
    </aside>
  );
}
