"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavStyle = "editorial" | "compare" | "tour";

const NAV_ITEMS = [
  { label: "Product", href: "#product" },
  { label: "Pricing", href: "#pricing" },
  { label: "See it run", href: "/reel" },
  { label: "Changelog", href: "#" },
];

export function MarketingNav({
  variant = "editorial",
  variantLabel,
}: {
  variant?: NavStyle;
  variantLabel?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full backdrop-blur",
        variant === "compare"
          ? "border-b border-ink/10 bg-page/85"
          : variant === "tour"
            ? "border-b border-border-default/60 bg-page/80"
            : "border-b border-border-default/50 bg-page/85",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Logomark size={24} />
          <span className="font-serif text-[16px] font-medium tracking-tight text-ink">
            Fluxora
          </span>
          {variantLabel ? (
            <span className="ml-2 rounded-full border border-border-default bg-card-warm/70 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
              {variantLabel} mock
            </span>
          ) : null}
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_ITEMS.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className="text-[12.5px] text-ink-warm hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="#"
            className="hidden text-[12.5px] text-ink-warm hover:text-ink sm:inline"
          >
            Sign in
          </Link>
          <Button size="sm" asChild>
            <Link href="#">
              Try free
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border-default/60 bg-surface/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-5">
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <Logomark size={22} />
            <span className="font-serif text-[16px] font-medium text-ink">
              Fluxora
            </span>
          </div>
          <p className="mt-3 max-w-xs text-[12.5px] leading-[1.6] text-subtle">
            The ops platform for the team running 3 a.m. trucks and 9 a.m.
            invoices.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Built in San Francisco
          </p>
        </div>
        <FooterCol
          title="Product"
          items={["Features", "Pricing", "Watch the reel", "Changelog"]}
        />
        <FooterCol
          title="Company"
          items={["About", "Careers", "Press", "Contact"]}
        />
        <FooterCol
          title="Legal"
          items={["Terms", "Privacy", "Security", "Status"]}
        />
      </div>
      <div className="border-t border-border-default/60 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 font-mono text-[10px] text-subtle">
          <span>© 2026 Fluxora, Inc.</span>
          <span>v1.4.2 · all systems normal</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it}>
            <Link
              href="#"
              className="text-[12.5px] text-ink-warm hover:text-ink"
            >
              {it}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
