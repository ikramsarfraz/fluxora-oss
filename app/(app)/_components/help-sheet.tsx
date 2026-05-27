"use client";

import {
  ArrowUpRight,
  Calendar,
  Mail,
  Play,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { changelogAnchorId, changelogReleases } from "@/lib/changelog";
import { shortcutGroups } from "@/lib/shortcuts";
import { tourForPathname } from "@/lib/tour/registry";
import { cn } from "@/lib/utils";

export type HelpSheetTicket = {
  id: string;
  shortId: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
  category?: string | null;
  updatedRelative: string;
};

type HelpSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the tour id to launch (cold-start, orders-new, bills-new).
   *  Omitting the id keeps the legacy "any tour" dispatch path working. */
  onStartTour: (tourId?: string) => void;
  tenantName: string;
  tenantSlug: string;
  planLabel: string;
  isPriorityPlan: boolean;
  version: string;
  tickets: HelpSheetTicket[];
};

function ticketPillClass(status: HelpSheetTicket["status"]): string {
  switch (status) {
    case "resolved":
      return "bg-success-bg text-success-fg border-success-border";
    case "in_progress":
    case "open":
    default:
      return "bg-info-bg text-info-fg border-info-border";
  }
}

function ticketPillLabel(status: HelpSheetTicket["status"]): string {
  if (status === "resolved") return "Resolved";
  return "In progress";
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function HelpSheet({
  open,
  onOpenChange,
  onStartTour,
  tenantName,
  tenantSlug,
  planLabel,
  isPriorityPlan,
  version,
  tickets,
}: HelpSheetProps) {
  const pathname = usePathname();
  // Pick the route-specific tour from the registry. Returns null on routes
  // we don't yet have a tour for — the drawer surfaces a "tour not available
  // here yet" hint in that case.
  const contextualTour = tourForPathname(pathname);
  const recentUpdates = changelogReleases.slice(0, 3);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-[560px] !max-w-[96vw] flex-col gap-0 bg-page p-0 sm:!max-w-[560px]"
        aria-labelledby="help-title"
      >
        {/* Header */}
        <header className="flex items-center gap-[14px] border-b-[0.5px] border-border-default bg-surface px-[22px] pb-4 pt-[18px]">
          <span
            aria-hidden
            className="relative grid size-8 place-items-center rounded-md bg-forest text-[15px] font-semibold text-card-warm before:absolute before:bottom-[5px] before:left-[8px] before:right-[8px] before:h-[1.5px] before:bg-gold before:content-['']"
          >
            F
          </span>
          <div className="min-w-0">
            <SheetTitle
              id="help-title"
              className="text-[16px] font-semibold tracking-[-0.01em] text-ink"
            >
              Help &amp; documentation
            </SheetTitle>
            <SheetDescription className="mt-[1px] font-mono text-[11px] tracking-[0.02em] text-subtle">
              {tenantSlug} · v {version}
            </SheetDescription>
          </div>
          <div className="ml-auto flex gap-[6px]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid size-7 place-items-center rounded-md border-[0.5px] border-border-soft bg-card text-ink-warm transition-colors hover:bg-card-warm hover:text-forest"
              aria-label="Close help"
            >
              <X size={14} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto px-[22px] pb-7 pt-[18px]">
          {/* Contextual: take the tour */}
          <SectionHead
            label={`Because you’re on ${contextualTour ? contextualTour.label.replace(/\stour$/, "").replace(/ walkthrough$/, "") : (pathname ?? "this page")}`}
          />
          {contextualTour ? (
            <div className="flex items-start gap-3 rounded-lg border-[0.5px] border-border-soft bg-card-warm px-4 py-[14px]">
              <span
                aria-hidden
                className="grid size-[30px] shrink-0 place-items-center rounded-sm bg-forest-tint text-forest"
              >
                <Play size={14} strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold-deep">
                  Suggested · {contextualTour.duration}
                </div>
                <div className="mt-[2px] text-[13.5px] font-medium text-ink">
                  Take the {contextualTour.label.toLowerCase()}
                </div>
                <p className="mt-[3px] text-[12.5px] leading-[1.5] text-subtle">
                  {contextualTour.description}
                </p>
                <div className="mt-2 flex gap-[6px]">
                  <button
                    type="button"
                    onClick={() => {
                      onStartTour(contextualTour.id);
                    }}
                    className="inline-flex items-center gap-[5px] rounded-sm border-[0.5px] border-forest bg-forest px-[11px] py-[6px] text-[12px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
                  >
                    Start tour →
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-[5px] rounded-sm border-[0.5px] border-border-default bg-card px-[11px] py-[6px] text-[12px] font-medium text-ink-warm transition-colors hover:bg-surface"
                  >
                    End and continue
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border-[0.5px] border-dashed border-border-default px-4 py-3 text-[12.5px] leading-[1.5] text-subtle">
              We don&rsquo;t have a guided tour for this screen yet. Try the{" "}
              <Link
                href="/dashboard"
                className="border-b-[0.5px] border-forest-tint-deep text-forest transition-colors hover:border-forest"
              >
                Dashboard tour
              </Link>{" "}
              to see how the cards connect.
            </div>
          )}

          {/* Your support tickets */}
          <SectionHead
            label="Your support tickets"
            more={{ label: "View all →", href: "/support" }}
          />

          <div className="flex items-center gap-[14px] rounded-lg border-[0.5px] border-border-default bg-card px-4 py-[14px]">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium tracking-[-0.005em] text-ink">
                Stuck? Send it to the team.
              </div>
              <p className="mt-[2px] text-[12px] leading-[1.45] text-subtle">
                Most replies inside an hour during business days.
              </p>
            </div>
            <Link
              href="/support/new"
              className="inline-flex shrink-0 items-center gap-[7px] rounded-md bg-forest px-[13px] py-[9px] text-[13px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
            >
              <Plus size={13} strokeWidth={1.5} aria-hidden />
              New ticket
            </Link>
          </div>

          {tickets.length > 0 ? (
            <>
              <div className="h-2" />
              <div className="overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-card">
                {tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/support/${ticket.id}`}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b-[0.5px] border-divider px-4 py-[13px] transition-colors last:border-b-0 hover:bg-card-warm"
                  >
                    <span className="min-w-[64px] font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">
                      {ticket.shortId}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium tracking-[-0.005em] text-ink">
                        {ticket.subject}
                      </div>
                      <div className="mt-[3px] flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.04em] text-subtle">
                        {ticket.category ? (
                          <>
                            <span>{ticket.category}</span>
                            <span aria-hidden className="opacity-40">·</span>
                          </>
                        ) : null}
                        <span>{ticket.updatedRelative}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-[5px] rounded-full border-[0.5px] px-2 py-[3px] text-[10.5px] font-medium leading-[1.2] whitespace-nowrap",
                        ticketPillClass(ticket.status),
                      )}
                    >
                      <span
                        aria-hidden
                        className="inline-block size-[5px] rounded-full bg-current"
                      />
                      {ticketPillLabel(ticket.status)}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between px-1 py-[6px] font-mono text-[11px] tracking-[0.04em] text-subtle">
                <span>
                  {tickets.length} of {tickets.length} tickets · {tenantSlug}
                </span>
                <Link
                  href="/support"
                  className="border-b-[0.5px] border-forest-tint-deep pb-[1px] text-forest transition-colors hover:border-forest"
                >
                  Open support inbox ↗
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="h-2" />
              <div className="rounded-lg border-[0.5px] border-dashed border-border-default px-4 py-5 text-center text-[12.5px] text-subtle">
                No tickets yet — the team is one click away when you need it.
              </div>
            </>
          )}

          {/* Recent updates */}
          <SectionHead
            label="Recent updates"
            more={{ label: "Full changelog →", href: "/changelog" }}
          />

          <div className="flex flex-col gap-2">
            {recentUpdates.map((release) => (
              <Link
                key={release.version}
                href={`/changelog#${changelogAnchorId(release.version)}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-[0.5px] border-border-soft bg-card px-[14px] py-3 transition-colors hover:border-forest-bright hover:bg-card-warm"
              >
                <span className="inline-block min-w-[74px] rounded-sm border-[0.5px] border-border-soft bg-surface px-2 py-[3px] text-center font-mono text-[10.5px] font-medium tracking-[0.005em] text-ink">
                  {release.version}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium tracking-[-0.005em] text-ink">
                    {release.title}
                  </div>
                  <p className="mt-[2px] truncate text-[11.5px] leading-[1.45] text-subtle">
                    {release.summary}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                  {formatShortDate(release.postedAt)}
                </span>
              </Link>
            ))}
          </div>

          {/* Keyboard shortcuts */}
          <SectionHead label="Keyboard shortcuts" />
          <div className="overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-card">
            {shortcutGroups.map((group, idx) => (
              <div
                key={group.heading}
                className={cn(
                  "px-[18px] pb-4 pt-[14px]",
                  idx > 0 && "border-t-[0.5px] border-divider",
                )}
              >
                <div className="mb-[10px] text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  {group.heading}
                </div>
                <ul className="flex flex-col">
                  {group.shortcuts.map((sc) => (
                    <li
                      key={sc.label}
                      className="grid grid-cols-[1fr_auto] items-center gap-[14px] py-[6px] text-[13px] text-ink-warm"
                    >
                      <span>{sc.label}</span>
                      <span className="flex items-center gap-1">
                        {sc.chord.map((atom, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <kbd className="rounded-sm border-[0.5px] border-border-soft bg-surface px-[7px] py-[3px] font-mono text-[10.5px] font-medium tracking-[0.02em] text-ink">
                              {atom}
                            </kbd>
                            {i < sc.chord.length - 1 ? (
                              <span
                                aria-hidden
                                className="px-[1px] font-mono text-[11px] text-muted"
                              >
                                {sc.connector ?? "+"}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Talk to us */}
          <SectionHead label="Talk to us" />
          <div className="rounded-lg bg-ink px-5 py-[18px] text-card-warm">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-tint">
              Support · Mon–Fri
            </div>
            <h3 className="mt-1 text-[17px] font-semibold leading-[1.25] tracking-[-0.015em]">
              Stuck on something? Our team replies in under an hour during
              business days.
            </h3>
            <p className="mt-[6px] text-[13px] leading-[1.55] text-card-warm/70">
              Owners and admins on Growth and Enterprise plans get priority —
              operators on Starter get same-day responses.
            </p>
            <div className="mt-[14px] flex flex-wrap gap-2">
              <div className="flex min-w-[140px] flex-1 flex-col gap-[2px] rounded-md border-[0.5px] border-card-warm/15 bg-card-warm/[0.06] px-[14px] py-[10px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-forest-tint">
                  Median reply
                </span>
                <span className="text-[13.5px] font-medium text-card-warm">
                  42 minutes
                </span>
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-[2px] rounded-md border-[0.5px] border-card-warm/15 bg-card-warm/[0.06] px-[14px] py-[10px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-forest-tint">
                  Your plan
                </span>
                <span className="text-[13.5px] font-medium text-card-warm">
                  {planLabel}
                  {isPriorityPlan ? " · priority" : ""}
                </span>
              </div>
            </div>
            <div className="mt-[14px] flex flex-wrap gap-2">
              <Link
                href="/support/new"
                className="inline-flex items-center gap-[6px] rounded-md bg-gold px-[14px] py-[9px] text-[13px] font-medium text-ink transition-colors hover:bg-[#D9BB7A]"
              >
                <Mail size={13} strokeWidth={1.5} aria-hidden />
                Start a ticket
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-[6px] rounded-md border-[0.5px] border-card-warm/20 px-[14px] py-[9px] text-[13px] font-medium text-card-warm transition-colors hover:bg-card-warm/10"
              >
                <Calendar size={13} strokeWidth={1.5} aria-hidden />
                Book 15-min call
              </Link>
            </div>
          </div>

          <div className="h-3" />
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-[0.5px] border-border-soft bg-card px-[14px] py-[11px]">
            <span
              aria-hidden
              className="inline-block size-[8px] rounded-full bg-success-fg shadow-[0_0_0_3px_rgba(74,107,47,0.18)]"
            />
            <div>
              <div className="text-[12.5px] font-medium text-ink">
                All systems operational
              </div>
            </div>
            <Link
              href="https://status.fluxora.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-[5px] border-b-[0.5px] border-forest-tint-deep pb-[1px] font-mono text-[11px] tracking-[0.02em] text-forest transition-colors hover:border-forest"
            >
              status.fluxora.app
              <ArrowUpRight size={11} strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t-[0.5px] border-border-default bg-surface px-[22px] py-3">
          <span className="font-mono text-[11px] tracking-[0.04em] text-subtle">
            <span className="text-ink-warm">Fluxora</span> · {version} ·{" "}
            {tenantSlug}
          </span>
          <span className="inline-flex items-center gap-[7px] font-mono text-[11px] tracking-[0.04em] text-subtle">
            <kbd className="rounded-sm border-[0.5px] border-border-soft bg-card px-[7px] py-[2px] font-mono text-[10.5px] text-ink-warm">
              Esc
            </kbd>
            to close
          </span>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function SectionHead({
  label,
  more,
}: {
  label: string;
  more?: { label: string; href: string };
}) {
  return (
    <div className="my-[18px] flex items-center gap-[10px] first:mt-[6px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
        {label}
      </span>
      <span aria-hidden className="h-[0.5px] flex-1 bg-border-soft" />
      {more ? (
        <Link
          href={more.href}
          className="border-b-[0.5px] border-forest-tint-deep pb-[1px] font-mono text-[11px] tracking-[0.02em] text-forest transition-colors hover:border-forest"
        >
          {more.label}
        </Link>
      ) : null}
    </div>
  );
}
