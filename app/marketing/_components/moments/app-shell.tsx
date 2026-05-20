"use client";

import { motion, useInView } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronRight } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// Hand-crafted "marketing-scale" Fluxora app shell for product moments.
// Wraps each moment in a believable app frame — but no sidebar. Marketing
// pages already advertise the other surfaces via chapter tabs or section
// grids; the sidebar inside each moment was just stealing pixels.
//
// Two rendering modes:
//
// 1. **Card mode** (default). The shell is a standalone card with rounded
//    corners, border, drop shadow — sized to its content. Used on the
//    editorial / compare / tour pages where each moment sits in natural
//    page flow.
//
// 2. **Bare mode** (via BareShellProvider). The shell drops its own
//    border / rounded corners / shadow and stretches to fill the parent's
//    height. Used inside the walkthrough's fixed 640px hero frame so the
//    moment fills the frame the same way the transition cards do — no
//    inset white gap from nested chromes.

const DEFAULT_LOOP_MS = 7000;

// Bare-mode context. When `true`, MarketingAppShell suppresses its own
// card chrome and stretches `h-full` so the parent (e.g. the walkthrough
// hero's 640px frame) provides the chrome instead.
const BareShellContext = createContext(false);

export function BareShellProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BareShellContext.Provider value={true}>
      {children}
    </BareShellContext.Provider>
  );
}

type NavKey =
  | "dashboard"
  | "customers"
  | "suppliers"
  | "products"
  | "inventory"
  | "orders"
  | "invoices"
  | "payments"
  | "bills"
  | "banking";

export type AppShellTone = "forest" | "success" | "warning" | "info";

export function MarketingAppShell({
  activeNav: _activeNav,
  crumbs,
  rightSlot,
  children,
  label,
  tone = "forest",
  loopMs = DEFAULT_LOOP_MS,
  /** Visible vertical space the main area should occupy in card mode. */
  bodyHeight = "min-h-[460px]",
}: {
  activeNav: NavKey;
  crumbs: string[];
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  label?: string;
  tone?: AppShellTone;
  loopMs?: number;
  bodyHeight?: string;
}) {
  void _activeNav;

  const bare = useContext(BareShellContext);

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const [loopKey, setLoopKey] = useState(0);
  const hasBeenSeen = useRef(false);

  useEffect(() => {
    if (!inView) return;
    if (hasBeenSeen.current) {
      setLoopKey((k) => k + 1);
    }
    hasBeenSeen.current = true;
    const id = setInterval(() => setLoopKey((k) => k + 1), loopMs);
    return () => clearInterval(id);
  }, [inView, loopMs]);

  const tabTone =
    tone === "success"
      ? "bg-success-bg text-success-fg border-success-border/60"
      : tone === "warning"
        ? "bg-warning-bg text-warning-fg border-warning-border/60"
        : tone === "info"
          ? "bg-info-bg text-info-fg border-info-border/60"
          : "bg-forest-tint text-forest-mid border-forest-tint-deep/60";

  return (
    <div
      ref={ref}
      className={cn("relative", bare && "h-full")}
      style={{ overflowAnchor: "none" }}
    >
      {/* Floating label tab — only shown in card mode. In bare mode the
          parent frame already carries chapter context (e.g. the
          walkthrough's caption strip). */}
      {label && !bare ? (
        <div
          className={cn(
            "absolute left-6 -top-3 z-10 inline-flex items-center gap-1.5 rounded-full border bg-card-warm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] shadow-sm",
            tabTone,
          )}
        >
          <span className="size-1 rounded-full bg-current" />
          {label}
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col overflow-hidden bg-card-warm",
          bare
            ? "h-full"
            : "rounded-2xl border border-border-default shadow-[0_22px_50px_-30px_rgba(31,58,46,0.35)]",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-default bg-surface/40 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Logomark size={18} />
            <span className="font-serif text-[14px] font-medium text-ink">
              Fluxora
            </span>
            <span className="rounded-full border border-border-default bg-card-warm px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle">
              pacificwharf
            </span>

            {crumbs.length > 0 ? (
              <span className="hidden h-3 w-px bg-border-default md:block" />
            ) : null}

            <nav className="hidden items-center gap-1.5 text-[13px] md:flex">
              {crumbs.map((crumb, idx) => {
                const last = idx === crumbs.length - 1;
                return (
                  <span key={crumb} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        last
                          ? "font-medium text-ink"
                          : "text-subtle hover:text-ink-warm",
                      )}
                    >
                      {crumb}
                    </span>
                    {!last ? (
                      <ChevronRight
                        className="size-3 text-subtle"
                        strokeWidth={2}
                      />
                    ) : null}
                  </span>
                );
              })}
            </nav>
          </div>

          {rightSlot ? (
            <div className="flex items-center gap-2">{rightSlot}</div>
          ) : null}
        </header>

        <main
          className={cn(
            "flex flex-col bg-page",
            // Card mode keeps a min-height so the moment doesn't collapse
            // when its content is short. Bare mode stretches via flex-1 so
            // the moment fills the parent frame.
            bare ? "flex-1" : bodyHeight,
          )}
        >
          <div key={loopKey} className="flex flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Small floating pulse — used for "live" indicators inside scenes.
export function PulseDot({
  tone = "forest",
}: {
  tone?: "forest" | "warning" | "success";
}) {
  const dot =
    tone === "warning"
      ? "bg-warning-fg"
      : tone === "success"
        ? "bg-success-fg"
        : "bg-forest-mid";
  return (
    <span className="relative flex size-1.5">
      <motion.span
        className={cn("absolute inset-0 rounded-full", dot)}
        animate={{ opacity: [0.35, 0, 0.35], scale: [1, 2, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className={cn("relative size-1.5 rounded-full", dot)} />
    </span>
  );
}
