import type { Metadata } from "next";

import { ChangelogShell } from "@/components/changelog/changelog-shell";
import {
  MarketingTopNav,
  Ribbon,
  SiteFooter,
} from "@/components/legal/marketing-chrome";
import { changelogReleases } from "@/lib/changelog";
import { roadmapItems } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "Changelog · Fluxora",
  description: "Product updates, improvements, and fixes for the Fluxora ERP platform.",
};

export default function ChangelogPage() {
  const latest = changelogReleases[0];
  const postedLabel = latest
    ? new Date(latest.postedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <Ribbon
        lead="§ Changelog · ledger of releases"
        middle="Newest first"
        trailing={{ label: "Subscribe via RSS", href: "#subscribe" }}
      />
      <MarketingTopNav activeHref="/changelog" />

      <header className="relative overflow-hidden border-b-[0.5px] border-border-default px-8 pb-9 pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 14% 0%, rgba(31,58,46,0.06) 0%, transparent 65%)",
          }}
        />
        <div className="relative z-10 mx-auto grid w-full max-w-[1200px] items-end gap-8 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-[10px] text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
              <span aria-hidden className="inline-block size-[5px] bg-forest" />
              <span>Product ledger</span>
              <span aria-hidden className="font-normal opacity-50">
                ·
              </span>
              <span>Folio 03 of 03</span>
            </div>
            <h1 className="mt-[14px] text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[52px] lg:text-[60px]">
              Changelog
            </h1>
            <p className="mt-[18px] max-w-[580px] text-[15.5px] leading-[1.55] text-subtle sm:text-[17.5px]">
              Every line we shipped, smoothed, or fixed. Bookkeeping for the
              product itself — kept in a careful hand, posted in arrears, and
              never quietly rewritten.
            </p>
          </div>
          {latest ? (
            <div className="flex min-w-[220px] flex-col gap-2 rounded-md border-[0.5px] border-border-default bg-card-warm px-[18px] py-[14px] shadow-[0_0.5px_0_rgba(26,26,20,0.04),0_1px_2px_rgba(26,26,20,0.04)]">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                Current release
              </span>
              <div className="font-mono text-[18px] font-medium tracking-[-0.005em] text-ink">
                {latest.version}
                <small className="ml-[6px] font-normal text-[11px] text-subtle">
                  · stable
                </small>
              </div>
              <div className="my-[2px] h-[0.5px] bg-border-soft" />
              <div className="flex items-baseline justify-between gap-[14px] font-mono text-[11px] tracking-[0.04em] text-subtle">
                <span>Posted</span>
                <span className="text-ink-warm">{postedLabel}</span>
              </div>
              <div className="flex items-baseline justify-between gap-[14px] font-mono text-[11px] tracking-[0.04em] text-subtle">
                <span>Entries</span>
                <span className="text-ink-warm">
                  {changelogReleases.length} releases
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <ChangelogShell releases={changelogReleases} roadmap={roadmapItems} />

      <SiteFooter />
    </div>
  );
}
