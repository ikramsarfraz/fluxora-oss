import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Film,
  GitCompare,
  Map,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Fluxora — landing page mocks",
  description:
    "Four variations of the Fluxora marketing landing page — editorial, comparison, product tour, single-narrative walkthrough.",
};

type Variant = {
  slug: string;
  letter: "A" | "B" | "C" | "D";
  name: string;
  tag: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  oneLiner: string;
  whoFor: string;
  bestFor: string[];
  tradeoffs: string[];
  tone: {
    head: string;
    body: string;
    accent: string;
    chip: string;
  };
};

const VARIANTS: Variant[] = [
  {
    slug: "editorial",
    letter: "A",
    name: "Editorial",
    tag: "Magazine · calm · long-form",
    icon: BookOpen,
    oneLiner: "Magazine-style. Quiet. Premium.",
    whoFor:
      "For ops directors and operations-led buyers who hate sales pages. Reads like a feature in Monocle.",
    bestFor: [
      "Slower, considered buyers",
      "Brand-conscious distribution teams",
      "Inbound traffic from newsletters / podcasts",
    ],
    tradeoffs: [
      "Slower to first CTA",
      "Less direct on pricing",
      "Needs strong copy to carry the weight",
    ],
    tone: {
      head: "text-ink",
      body: "text-ink-warm",
      accent: "text-forest-mid",
      chip: "bg-forest-tint/40 text-forest-mid border-forest-tint-deep/60",
    },
  },
  {
    slug: "compare",
    letter: "B",
    name: "Compare",
    tag: "Side-by-side · punchy · pain-led",
    icon: GitCompare,
    oneLiner: "Spreadsheets vs Fluxora. Visceral.",
    whoFor:
      "For operators in pain. Designed to make someone forward it to their boss with 'this is us.'",
    bestFor: [
      "Cold paid traffic",
      "Outbound emails to QuickBooks/Excel shops",
      "Audience that hasn't shopped ERPs before",
    ],
    tradeoffs: [
      "Direct tone may put off enterprise buyers",
      "Lots of contrast = lots of visual weight",
      "Needs the time-savings claim to be defensible",
    ],
    tone: {
      head: "text-ink",
      body: "text-ink-warm",
      accent: "text-warning-fg",
      chip: "bg-warning-bg/50 text-warning-fg border-warning-border/70",
    },
  },
  {
    slug: "tour",
    letter: "C",
    name: "Tour",
    tag: "Product-led · scrollthrough · technical",
    icon: Map,
    oneLiner: "Apple-product-page energy.",
    whoFor:
      "For technical buyers, evaluators, and product-led signups who want to see everything before they touch the form.",
    bestFor: [
      "Product Hunt / Hacker News traffic",
      "Self-serve signups with high intent",
      "Evaluation by an internal ops lead",
    ],
    tradeoffs: [
      "Longest scroll of the three",
      "Heaviest page weight (8 embeds)",
      "Loses casual visitors who don't scroll",
    ],
    tone: {
      head: "text-ink",
      body: "text-ink-warm",
      accent: "text-info-fg",
      chip: "bg-info-bg/40 text-info-fg border-info-border/70",
    },
  },
  {
    slug: "walkthrough",
    letter: "D",
    name: "Walkthrough",
    tag: "One demo · single narrative · cinematic",
    icon: Film,
    oneLiner: "One Tuesday morning, autopilot.",
    whoFor:
      "For visitors who want the story, not the catalog. Hero is a single merged demo that walks through five workflows with side-by-side Manual vs Fluxora comparisons. Rest of the page is short.",
    bestFor: [
      "Cold visitors who skim",
      "Mobile-first audiences",
      "Demo-led sales conversations",
    ],
    tradeoffs: [
      "Less feature coverage than Editorial / Tour",
      "Hero auto-plays — visitors who hate that will pause",
      "One scene at a time → narrower SEO surface per scroll",
    ],
    tone: {
      head: "text-ink",
      body: "text-ink-warm",
      accent: "text-forest-mid",
      chip: "bg-forest-tint/40 text-forest-mid border-forest-tint-deep/60",
    },
  },
];

export default function MarketingMocksIndex() {
  return (
    <main className="min-h-screen bg-page">
      {/* Header */}
      <header className="border-b border-border-default/60 bg-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logomark size={22} />
            <span className="font-serif text-[15px] font-medium text-ink">
              Fluxora
            </span>
            <span className="ml-2 rounded-full border border-border-default bg-card-warm/70 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
              Marketing mocks
            </span>
          </Link>
          <Link
            href="/reel"
            className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle hover:text-ink"
          >
            ← Back to the reel directory
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center md:pt-24">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-forest-mid">
          Three flavors · pick a fight
        </p>
        <h1 className="mt-4 font-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink md:text-[60px]">
          Same product.
          <br />
          <span className="text-forest-mid">Three landing pages.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.6] text-ink-warm">
          Each one is a complete page — hero, demos, pricing, footer. They
          differ in tone, structure, and the buyer they speak to. Open them
          full-screen to feel the difference.
        </p>
      </section>

      {/* Variant cards */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {VARIANTS.map((v) => (
            <VariantCard key={v.slug} variant={v} />
          ))}
        </div>
      </section>

      {/* Side-by-side previews */}
      <section className="border-t border-border-default/60 bg-surface/30 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              The actual pages
            </p>
            <h2 className="mt-3 font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink md:text-[40px]">
              At a glance.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[13.5px] text-subtle">
              Each thumbnail is a live iframe of the actual page. Click into a
              variant to open it full-screen.
            </p>
          </header>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {VARIANTS.map((v) => (
              <PreviewFrame key={v.slug} variant={v} />
            ))}
          </div>
        </div>
      </section>

      {/* Decision helper */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <header className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
            Decision guide
          </p>
          <h2 className="mt-3 font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink md:text-[40px]">
            Which one to ship?
          </h2>
        </header>

        <div className="mt-10 overflow-hidden rounded-2xl border border-border-default bg-card-warm">
          <table className="w-full text-[13px]">
            <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-5 py-3 text-left font-medium">If you&apos;re…</th>
                <th className="px-5 py-3 text-left font-medium">Pick</th>
                <th className="px-5 py-3 text-left font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="text-ink-warm">
              <Row
                cond="Going wide on paid social ads"
                pick="Compare"
                why="The split-screen hero is screenshot-shareable. Pain → solution sells in 8 seconds."
              />
              <Row
                cond="Targeting senior ops at mid-market distributors"
                pick="Editorial"
                why="Quiet authority reads as premium. Lets the product breathe."
                highlight
              />
              <Row
                cond="Driving Product Hunt / Hacker News signups"
                pick="Tour"
                why="High-intent technical buyers want everything on one page. Deep scroll converts here."
              />
              <Row
                cond="Doing outbound to spreadsheet-only shops"
                pick="Compare"
                why="Calls out the exact pain by name. Operators forward it."
              />
              <Row
                cond="Not sure"
                pick="Compare → Editorial"
                why="Ship Compare for paid, Editorial for organic. Tour later as a /product-tour subpage."
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default/60 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          <span>3 mocks · 1 product · 0 designers harmed</span>
          <Link
            href="/reel"
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            Reel directory
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </footer>
    </main>
  );
}

function VariantCard({ variant }: { variant: Variant }) {
  const Icon = variant.icon;
  return (
    <article className="flex flex-col rounded-2xl border-2 border-border-default bg-card-warm p-6 transition hover:-translate-y-0.5 hover:border-ink-warm/40 hover:shadow-[0_18px_40px_-20px_rgba(31,58,46,0.35)]">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
            variant.tone.chip,
          )}
        >
          <Icon className="size-3" strokeWidth={2} />
          Variant {variant.letter}
        </span>
        <span className="font-mono text-[10.5px] text-subtle">
          {variant.tag}
        </span>
      </div>

      <h3
        className={cn(
          "mt-5 font-serif text-[28px] font-medium leading-tight tracking-tight",
          variant.tone.head,
        )}
      >
        {variant.name}
      </h3>
      <p
        className={cn(
          "mt-1 font-serif text-[18px] italic leading-snug",
          variant.tone.accent,
        )}
      >
        {variant.oneLiner}
      </p>

      <p
        className={cn(
          "mt-4 text-[13px] leading-[1.6]",
          variant.tone.body,
        )}
      >
        {variant.whoFor}
      </p>

      <div className="mt-5 space-y-3 border-t border-border-default pt-4 text-[12px]">
        <BulletList
          label="Best for"
          items={variant.bestFor}
          accent={variant.tone.accent}
        />
        <BulletList
          label="Trade-offs"
          items={variant.tradeoffs}
          accent="text-subtle"
        />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/marketing/${variant.slug}`} target="_blank">
            Open Variant {variant.letter}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Link
          href={`/marketing/${variant.slug}`}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle hover:text-ink"
        >
          /marketing/{variant.slug}
        </Link>
      </div>
    </article>
  );
}

function BulletList({
  label,
  items,
  accent,
}: {
  label: string;
  items: string[];
  accent: string;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <ul className="mt-1 space-y-0.5 text-ink-warm">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-1.5">
            <span className={cn("mt-1 size-1 shrink-0 rounded-full", accent.replace("text-", "bg-"))} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewFrame({ variant }: { variant: Variant }) {
  return (
    <Link
      href={`/marketing/${variant.slug}`}
      target="_blank"
      className="group block"
    >
      <div className="relative overflow-hidden rounded-2xl border-2 border-border-default bg-page shadow-sm transition group-hover:border-ink-warm/40 group-hover:shadow-[0_22px_50px_-25px_rgba(31,58,46,0.45)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 border-b border-border-default bg-surface px-3 py-1.5">
          <span className="size-1.5 rounded-full bg-danger-fg/60" />
          <span className="size-1.5 rounded-full bg-warning-fg/60" />
          <span className="size-1.5 rounded-full bg-success-fg/60" />
          <span className="ml-2 font-mono text-[8.5px] text-subtle">
            fluxora.com/marketing/{variant.slug}
          </span>
        </div>

        {/* The actual page in an iframe, scaled down */}
        <div className="relative aspect-[9/16] overflow-hidden bg-page">
          <iframe
            src={`/marketing/${variant.slug}`}
            title={`Variant ${variant.letter} preview`}
            className="absolute left-0 top-0 origin-top-left border-0"
            style={{
              width: "200%",
              height: "200%",
              transform: "scale(0.5)",
            }}
            loading="lazy"
            scrolling="no"
          />
          {/* Overlay tag */}
          <div
            className={cn(
              "pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border bg-card-warm/95 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] backdrop-blur",
              variant.tone.chip,
            )}
          >
            Variant {variant.letter}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className={cn("font-serif text-[16px] font-medium", variant.tone.head)}>
          {variant.name}
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle group-hover:text-ink">
          Open
          <ArrowRight
            className="size-2.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.4}
          />
        </span>
      </div>
    </Link>
  );
}

function Row({
  cond,
  pick,
  why,
  highlight,
}: {
  cond: string;
  pick: string;
  why: string;
  highlight?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-t border-border-default",
        highlight && "bg-forest-tint/15",
      )}
    >
      <td className="px-5 py-3">{cond}</td>
      <td className="px-5 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium",
            highlight
              ? "bg-forest-mid text-card-warm"
              : "bg-surface text-ink",
          )}
        >
          {pick}
        </span>
      </td>
      <td className="px-5 py-3 text-subtle">{why}</td>
    </tr>
  );
}
