import Link from "next/link";

import { cn } from "@/lib/utils";

export function BrandWordmark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-end gap-0 text-[21px] font-semibold leading-none tracking-[-0.03em] text-ink",
        className,
      )}
      aria-label="Fluxora home"
    >
      <span
        aria-hidden
        className="relative mr-[9px] grid size-7 place-items-center rounded-md bg-forest text-[15px] font-semibold text-card-warm before:absolute before:bottom-[5px] before:left-[7px] before:right-[7px] before:h-[1.5px] before:bg-gold before:content-['']"
      >
        F
      </span>
      <span>
        <span className="relative pb-[5px] after:absolute after:bottom-0 after:left-[1px] after:right-[38%] after:h-[1.5px] after:bg-gold after:content-['']">
          Flu
        </span>
        xora
      </span>
    </Link>
  );
}

export type RibbonProps = {
  /** Leading mono caption, e.g. "§ Legal · Terms of Service" */
  lead: string;
  /** Middle slot, e.g. "Effective April 25, 2026" */
  middle?: string;
  /** Optional trailing link, e.g. "Read the Privacy Policy" */
  trailing?: { label: string; href: string };
};

export function Ribbon({ lead, middle, trailing }: RibbonProps) {
  return (
    <div className="border-b-[0.5px] border-forest bg-ink py-2 font-mono text-[11px] tracking-[0.04em] text-card-warm">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-[14px] px-8">
        <span>{lead}</span>
        {middle ? (
          <>
            <span className="opacity-40">/</span>
            <span>{middle}</span>
          </>
        ) : null}
        {trailing ? (
          <>
            <span className="opacity-40">/</span>
            <Link
              href={trailing.href}
              className="text-forest-tint underline underline-offset-[3px] transition-colors hover:text-card-warm"
            >
              {trailing.label}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

type NavLink = { label: string; href: string };
const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Product", href: "/#product" },
  { label: "Workflows", href: "/#how-it-works" },
  { label: "Customers", href: "/#customers" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Changelog", href: "/changelog" },
];

export function MarketingTopNav({
  activeHref,
}: {
  /** Pass the current pathname so the matching nav link gets the active style. */
  activeHref?: string;
}) {
  return (
    <nav className="sticky top-0 z-50 border-b-[0.5px] border-border-default bg-[rgba(245,239,224,0.86)] backdrop-blur-[12px]">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-8 px-8">
        <BrandWordmark />
        <div className="ml-[14px] hidden gap-[26px] md:flex">
          {DEFAULT_NAV_LINKS.map((link) => {
            const isActive = activeHref === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[13.5px] font-medium transition-colors",
                  isActive
                    ? "text-forest"
                    : "text-ink-warm hover:text-forest",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-[10px]">
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-md px-[18px] text-[13.5px] font-medium text-ink-warm transition-colors hover:bg-surface hover:text-ink sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-md bg-forest px-[18px] text-[13.5px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}

const FOOTER_COLS: Array<{
  heading: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    heading: "Product",
    links: [
      { label: "Inventory & lots", href: "/#features" },
      { label: "Sales orders", href: "/#features" },
      { label: "Invoicing", href: "/#features" },
      { label: "PDF import", href: "/#features" },
      { label: "Roles & permissions", href: "/#features" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "Customers", href: "/#customers" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/" },
      { label: "Onboarding guide", href: "/" },
      { label: "Status", href: "/" },
    ],
  },
  {
    heading: "Sign in",
    links: [
      { label: "Find your workspace", href: "/login" },
      { label: "Create a workspace", href: "/signup" },
      { label: "Contact sales", href: "/" },
    ],
  },
];

const BASE_LEGAL_LINKS: Array<{ label: string; href: string }> = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function SiteFooter({
  activeLegalHref,
}: {
  activeLegalHref?: "/privacy" | "/terms";
}) {
  return (
    <footer className="border-t-[0.5px] border-border-default bg-surface px-8 pb-6 pt-16">
      <div className="mx-auto grid w-full max-w-[1200px] gap-16 sm:grid-cols-[1.4fr_2fr]">
        <div className="flex max-w-[340px] flex-col gap-[14px]">
          <BrandWordmark />
          <p className="text-[13.5px] leading-[1.6] text-ink-warm">
            The multi-tenant operations platform for food and wholesale
            distribution teams. Cream canvas, forest ink, serious about lots.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["SOC 2 Type II", "GDPR", "PCI DSS L1"].map((bdg) => (
              <span
                key={bdg}
                className="rounded-sm border-[0.5px] border-border-soft bg-card-warm px-[9px] py-1 font-mono text-[10px] tracking-[0.06em] text-subtle"
              >
                {bdg}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-[14px] text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                {col.heading}
              </h4>
              <ul className="flex flex-col gap-[9px]">
                {col.links.map((link) => (
                  <li key={`${col.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-ink-warm transition-colors hover:text-forest"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-[14px] border-t-[0.5px] border-border-soft pt-6">
        <div className="font-mono text-[11px] tracking-[0.04em] text-subtle">
          © {new Date().getFullYear()} Fluxora, Inc.
        </div>
        <div className="flex gap-[18px] text-[12px] text-ink-warm">
          {BASE_LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-forest",
                activeLegalHref === link.href && "font-medium text-forest",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
