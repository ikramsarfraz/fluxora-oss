"use client";

import { Rss } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  changelogAnchorId,
  type ChangelogRelease,
  type ChangelogSectionKind,
} from "@/lib/changelog";
import { type RoadmapItem } from "@/lib/roadmap";
import { cn } from "@/lib/utils";

import styles from "./changelog-shell.module.css";

const SECTION_ORDER: ChangelogSectionKind[] = [
  "added",
  "improved",
  "fixed",
  "security",
];

const SECTION_LABEL: Record<ChangelogSectionKind, string> = {
  added: "Added",
  improved: "Improved",
  fixed: "Fixed",
  security: "Security & reliability",
};

const TAG_CLASS: Record<ChangelogSectionKind, string> = {
  added: "bg-success-bg text-success-fg border-success-border",
  improved: "bg-info-bg text-info-fg border-info-border",
  fixed: "bg-warning-bg text-warning-fg border-warning-border",
  security: "bg-[#EFE4D3] text-gold-deep border-[#D9C68B]",
};

const FILTER_OPTIONS: Array<{
  value: ChangelogSectionKind | "all";
  label: string;
  dotClass: string;
}> = [
  { value: "all", label: "All releases", dotClass: "bg-card-warm" },
  { value: "added", label: "Added", dotClass: "bg-success-fg" },
  { value: "improved", label: "Improved", dotClass: "bg-info-fg" },
  { value: "fixed", label: "Fixed", dotClass: "bg-warning-fg" },
  { value: "security", label: "Security", dotClass: "bg-gold-deep" },
];

function sectionEntryCount(release: ChangelogRelease, kind: ChangelogSectionKind) {
  return release.sections[kind]?.length ?? 0;
}

function releaseVisibleSections(
  release: ChangelogRelease,
  filter: ChangelogSectionKind | "all",
): ChangelogSectionKind[] {
  return SECTION_ORDER.filter((kind) => {
    if (sectionEntryCount(release, kind) === 0) return false;
    if (filter === "all") return true;
    return kind === filter;
  });
}

function formatShortMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChangelogShell({
  releases,
  roadmap,
}: {
  releases: readonly ChangelogRelease[];
  roadmap: readonly RoadmapItem[];
}) {
  const [filter, setFilter] = useState<ChangelogSectionKind | "all">("all");
  const [activeAnchor, setActiveAnchor] = useState<string>(
    releases[0] ? changelogAnchorId(releases[0].version) : "",
  );

  const visibleReleases = useMemo(() => {
    return releases
      .map((release) => ({
        release,
        kinds: releaseVisibleSections(release, filter),
      }))
      .filter((entry) => entry.kinds.length > 0);
  }, [releases, filter]);

  useEffect(() => {
    if (visibleReleases.length === 0) return;
    const ids = visibleReleases.map((entry) =>
      changelogAnchorId(entry.release.version),
    );
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    function update() {
      const y = window.scrollY + 140;
      let idx = 0;
      els.forEach((el, i) => {
        if (el.offsetTop <= y) idx = i;
      });
      setActiveAnchor(els[idx]?.id ?? "");
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [visibleReleases]);

  return (
    <>
      {/* Filter bar */}
      <div className="border-b-[0.5px] border-border-default bg-surface px-8 py-[14px]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-[18px]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Filter
          </span>
          <div className="flex flex-wrap gap-[6px]">
            {FILTER_OPTIONS.map((opt) => {
              const isActive = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-[6px] rounded-full border-[0.5px] px-[11px] py-[5px] text-[12px] font-medium transition-colors",
                    isActive
                      ? "border-forest bg-forest text-card-warm"
                      : "border-border-default bg-card-warm text-ink-warm hover:border-forest-bright hover:bg-card",
                  )}
                  aria-pressed={isActive}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block size-[6px] rounded-full",
                      isActive ? "bg-card-warm" : opt.dotClass,
                    )}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="px-8 pb-24 pt-14">
        <div className="mx-auto grid w-full max-w-[1200px] items-start gap-8 lg:grid-cols-[240px_1fr] lg:gap-16">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-[10px] border-b-[0.5px] border-border-default pb-[14px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Releases
            </div>
            <ol>
              {releases.map((release) => {
                const id = changelogAnchorId(release.version);
                const isActive = activeAnchor === id;
                return (
                  <li key={release.version}>
                    <a
                      href={`#${id}`}
                      className={cn(
                        "grid grid-cols-[auto_1fr_auto] items-center gap-[10px] border-b-[0.5px] border-divider py-[9px] font-mono text-[12px] transition-colors",
                        isActive
                          ? "text-forest"
                          : "text-ink-warm hover:text-forest",
                      )}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block size-[6px] rounded-full transition-colors",
                          isActive
                            ? "bg-gold shadow-[0_0_0_3px_rgba(201,169,97,0.18)]"
                            : "bg-muted",
                        )}
                      />
                      <span
                        className={cn(
                          "font-medium tracking-[0.005em]",
                          isActive ? "text-forest" : "text-ink",
                        )}
                      >
                        {release.version}
                      </span>
                      <span className="text-[10.5px] uppercase tracking-[0.04em] text-muted">
                        {new Date(release.postedAt).toLocaleDateString("en-US", {
                          month: "short",
                        })}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className={cn("flex max-w-[780px] flex-col", styles.releases)}>
            {visibleReleases.map(({ release, kinds }, idx) => {
              const id = changelogAnchorId(release.version);
              const isLatest = idx === 0 && filter === "all";
              return (
                <article
                  key={release.version}
                  id={id}
                  className={cn(styles.release, isLatest && styles.latest)}
                  aria-labelledby={`${id}-title`}
                >
                  <div className="mb-1 flex flex-wrap items-baseline gap-[14px]">
                    <span className="font-mono text-[18px] font-medium tracking-[-0.005em] text-ink tabular-nums">
                      {release.version}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-subtle">
                      {release.dateLabel}
                    </span>
                    {isLatest ? (
                      <span className="rounded-full bg-forest px-[9px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-card-warm">
                        Latest
                      </span>
                    ) : null}
                    <a
                      href={`#${id}`}
                      className="ml-auto font-mono text-[11px] tracking-[0.04em] text-muted transition-colors hover:text-forest"
                      aria-label={`Permalink to ${release.version}`}
                    >
                      #
                    </a>
                  </div>
                  <h2
                    id={`${id}-title`}
                    className="my-[6px] mb-3 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink sm:text-[26px]"
                  >
                    {release.title}
                  </h2>
                  <p className="mb-6 max-w-[680px] text-[15px] leading-[1.65] text-ink-warm">
                    {release.summary}
                  </p>

                  <div className="rounded-lg border-[0.5px] border-border-soft bg-card p-2 shadow-[0_0.5px_0_rgba(26,26,20,0.04),0_1px_2px_rgba(26,26,20,0.04)]">
                    {kinds.map((kind, kIdx) => {
                      const entries = release.sections[kind] ?? [];
                      return (
                        <div
                          key={kind}
                          className={cn(
                            "rounded-md px-[18px] py-[14px] pb-4",
                            styles.relSection,
                            styles[kind],
                            kIdx > 0 && "border-t-[0.5px] border-divider",
                          )}
                        >
                          <div className="mb-[10px] flex items-center gap-[10px]">
                            <span
                              className={cn(
                                "inline-flex items-center gap-[7px] rounded-full border-[0.5px] px-[10px] py-[3px] text-[11px] font-medium leading-[1.2]",
                                TAG_CLASS[kind],
                              )}
                            >
                              <span
                                aria-hidden
                                className="inline-block size-[5px] rounded-full bg-current"
                              />
                              {SECTION_LABEL[kind]}
                            </span>
                            <span className="ml-auto font-mono text-[11px] tracking-[0.04em] text-muted">
                              {entries.length}{" "}
                              {entries.length === 1 ? "entry" : "entries"}
                            </span>
                          </div>
                          <ul className="flex flex-col gap-2">
                            {entries.map((entry, i) => (
                              <li key={i}>{entry}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}

            {/* Roadmap teaser */}
            {filter === "all" && roadmap.length > 0 ? (
              <div className="mt-8 rounded-lg border-[0.5px] border-dashed border-border-default px-6 pb-[22px] pt-6">
                <div className="mb-[10px] flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-deep">
                  <span>In the next folio</span>
                  <span
                    aria-hidden
                    className="h-[0.5px] flex-1 bg-border-soft"
                  />
                </div>
                <h3 className="mb-[6px] text-[18px] font-semibold tracking-[-0.01em] text-ink">
                  What we&rsquo;re working on
                </h3>
                <p className="mb-[14px] text-[13.5px] leading-[1.6] text-ink-warm">
                  Not a promise — just the next pages of the ledger we expect to
                  post. Order and dates may shift if a customer ledger needs a
                  faster repair.
                </p>
                <ul className="flex flex-col">
                  {roadmap.map((item, idx) => (
                    <li
                      key={idx}
                      className="grid grid-cols-[auto_1fr_auto] items-baseline gap-[14px] border-b-[0.5px] border-divider py-[6px] text-[13.5px] text-ink-warm last:border-b-0"
                    >
                      <span className="min-w-[60px] font-mono text-[11px] tracking-[0.04em] text-muted">
                        {item.quarter}
                      </span>
                      <span>{item.description}</span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-gold-deep">
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Subscribe card */}
            {filter === "all" ? (
              <SubscribeCard />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function SubscribeCard() {
  return (
    <div
      id="subscribe"
      className="mt-12 grid items-center gap-6 rounded-lg bg-ink px-8 py-7 text-card-warm sm:grid-cols-[1fr_auto]"
    >
      <div>
        <div className="mb-[6px] font-mono text-[10px] uppercase tracking-[0.14em] text-forest-tint">
          Stay in the ledger
        </div>
        <h3 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.02em]">
          Get release notes by email.
        </h3>
        <p className="mt-[6px] max-w-[380px] text-[13.5px] leading-[1.55] text-card-warm/70">
          One short note per release — never marketing, never more than twice a
          month. Unsubscribe with a single click.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex items-center rounded-md border-[0.5px] border-card-warm/20 bg-card-warm/10"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <input
            type="email"
            name="email"
            placeholder="you@workshop.co"
            className="w-[200px] bg-transparent px-3 py-[10px] font-sans text-[13px] text-card-warm placeholder:text-card-warm/40 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-r-md bg-gold px-4 py-[10px] font-sans text-[12.5px] font-semibold text-ink transition-colors hover:bg-[#D9BB7A]"
          >
            Subscribe
          </button>
        </form>
        <Link
          href="/changelog.rss"
          className="inline-flex items-center gap-[6px] border-b-[0.5px] border-card-warm/30 pb-[1px] font-mono text-[11px] tracking-[0.04em] text-forest-tint transition-colors hover:border-card-warm hover:text-card-warm"
        >
          <Rss size={11} strokeWidth={1.5} aria-hidden />
          RSS feed →
        </Link>
      </div>
    </div>
  );
}
