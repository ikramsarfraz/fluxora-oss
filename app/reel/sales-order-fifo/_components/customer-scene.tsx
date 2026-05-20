"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Clock,
  Phone,
  Search,
  Tag,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { CUSTOMER } from "../_data/order";
import { FakeAppShell } from "./fake-app-shell";

// Scene 1: New order screen. Cursor types "Anch" in the customer search box,
// dropdown filters to Anchor Tavern, click lands. Customer card slides in
// with their tier-pricing, terms, and recent-history snapshot.

const TYPED_TARGET = "Anchor";
const TYPE_DELAY_MS = 60;
const RESULT_DELAY_MS = 200;
const SELECT_DELAY_MS = 1700;

const RECENT_HITS = [
  { name: "Anchor Tavern", city: "Tiburon, CA", tier: "Tier 2" },
  { name: "Ferry Plaza Cafe", city: "San Francisco, CA", tier: "Tier 1" },
  { name: "Foggy Knoll Bakery", city: "Daly City, CA", tier: "Tier 3" },
];

export function CustomerScene() {
  const [typed, setTyped] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Type the search term character by character
    for (let i = 1; i <= TYPED_TARGET.length; i++) {
      timers.push(
        setTimeout(() => {
          setTyped(TYPED_TARGET.slice(0, i));
        }, 350 + i * TYPE_DELAY_MS),
      );
    }
    // Show the dropdown shortly after typing finishes
    timers.push(
      setTimeout(
        () => setShowResults(true),
        350 + TYPED_TARGET.length * TYPE_DELAY_MS + RESULT_DELAY_MS,
      ),
    );
    // Select the top result
    timers.push(
      setTimeout(
        () => {
          setSelected(true);
          setShowResults(false);
        },
        350 +
          TYPED_TARGET.length * TYPE_DELAY_MS +
          RESULT_DELAY_MS +
          SELECT_DELAY_MS,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="customer-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Orders", "New order"]}>
        <div className="flex h-full flex-col p-8">
          <header>
            <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
              New sales order
            </h1>
            <p className="mt-1 text-[12.5px] text-subtle">
              Start by finding the customer.
            </p>
          </header>

          {/* Customer search box */}
          <div className="relative mt-6 max-w-[560px]">
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border bg-card-warm px-3 py-2.5 transition",
                showResults
                  ? "border-forest-mid ring-2 ring-forest-mid/20"
                  : "border-border-default",
              )}
            >
              <Search className="size-4 text-subtle" strokeWidth={2} />
              <span className="flex-1 text-[13px] text-ink">{typed}</span>
              {!selected ? <BlinkingCaret /> : null}
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                ⌘K
              </span>
            </div>

            {/* Dropdown of results */}
            <AnimatePresence>
              {showResults ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full left-0 right-0 z-10 mt-1 overflow-hidden rounded-md border border-border-default bg-card-warm shadow-lg"
                >
                  {RECENT_HITS.map((hit, idx) => (
                    <div
                      key={hit.name}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-[12.5px]",
                        idx === 0 && "bg-forest-tint/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2
                          className="size-3.5 text-subtle"
                          strokeWidth={1.8}
                        />
                        <span className="font-medium text-ink">
                          <Highlight match={typed}>{hit.name}</Highlight>
                        </span>
                        <span className="text-subtle">·</span>
                        <span className="text-subtle">{hit.city}</span>
                      </div>
                      <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-warm">
                        {hit.tier}
                      </span>
                    </div>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Customer card slides in after selection */}
          <AnimatePresence>
            {selected ? (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 max-w-[700px] overflow-hidden rounded-xl border border-border-default bg-card-warm shadow-sm"
              >
                <div className="flex items-start justify-between border-b border-border-default px-6 py-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif text-[22px] font-medium text-ink">
                        {CUSTOMER.name}
                      </h2>
                      <span className="rounded-full bg-forest-tint px-2 py-0.5 font-mono text-[10px] text-forest-mid">
                        {CUSTOMER.abbreviation}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-subtle">
                      <Phone className="size-3" strokeWidth={2} />
                      <span>(415) 555-0167</span>
                      <span>·</span>
                      <span>
                        {CUSTOMER.city}, {CUSTOMER.state}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill
                      icon={Tag}
                      label={CUSTOMER.tier}
                      tone="forest"
                    />
                    <Pill icon={Clock} label={CUSTOMER.terms} tone="info" />
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-border-default">
                  <Stat label="Lifetime revenue" value={CUSTOMER.lifetimeRevenue} />
                  <Stat label="Last order" value={CUSTOMER.lastOrder} />
                  <Stat label="Open balance" value="$0.00" tone="success" />
                </div>

                <div className="flex items-start gap-3 border-t border-border-default bg-surface/40 px-6 py-4">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-bg">
                    <TrendingUp
                      className="size-3.5 text-warning-fg"
                      strokeWidth={2}
                    />
                  </div>
                  <p className="text-[12.5px] leading-[1.55] text-ink-warm">
                    <span className="font-medium text-ink">Notes:</span>{" "}
                    {CUSTOMER.notes}
                  </p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function BlinkingCaret() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-[14px] w-[1.5px] bg-ink"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
    />
  );
}

function Highlight({
  match,
  children,
}: {
  match: string;
  children: string;
}) {
  if (!match) return <>{children}</>;
  const idx = children.toLowerCase().indexOf(match.toLowerCase());
  if (idx < 0) return <>{children}</>;
  return (
    <>
      {children.slice(0, idx)}
      <span className="bg-warning-bg/70 text-ink">
        {children.slice(idx, idx + match.length)}
      </span>
      {children.slice(idx + match.length)}
    </>
  );
}

function Pill({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  tone: "forest" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tone === "forest"
          ? "border-forest-tint-deep/60 bg-forest-tint/40 text-forest-mid"
          : "border-info-border/70 bg-info-bg/40 text-info-fg",
      )}
    >
      <Icon className="size-3" strokeWidth={2} />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="px-6 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-serif text-[18px] font-medium",
          tone === "success" ? "text-success-fg" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}
