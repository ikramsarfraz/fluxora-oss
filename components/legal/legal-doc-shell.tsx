import { ArrowUpRight, Download } from "lucide-react";
import Link from "next/link";

import {
  MarketingTopNav,
  Ribbon,
  SiteFooter,
  type RibbonProps,
} from "@/components/legal/marketing-chrome";

import styles from "./legal-doc-shell.module.css";
import {
  LegalTocScrollspy,
  type LegalTocItem,
} from "./legal-toc-scrollspy";

export type { LegalTocItem };

type LegalDocShellProps = {
  /** "Terms of Service", "Privacy Policy" */
  title: string;
  /** Eyebrow lead, e.g. "Legal" */
  eyebrow?: string;
  /** Eyebrow suffix after `· `, e.g. "Folio 02 of 03" */
  eyebrowSuffix?: string;
  /** Hero lede paragraph under the title. */
  lede?: string;
  /** "April 25, 2026" — also drives the ribbon middle slot. */
  lastUpdated: string;
  /** "2026.04" */
  version?: string;
  /** "~9 min" */
  readingTime?: string;
  /** Optional PDF download link. */
  pdfHref?: string;
  /** Optional revisions / changelog link. */
  revisionsHref?: string;
  /** Override the ribbon entirely. */
  ribbon?: RibbonProps;
  /** Used to mark the footer legal link active. */
  activeLegalHref?: "/privacy" | "/terms";
  /** "End of document · § 12 of 12" */
  docFootLabel?: string;
  /** Forward / backward sibling doc links. */
  docFootLinks?: Array<{ label: string; href: string }>;
  toc: LegalTocItem[];
  children: React.ReactNode;
};

export function LegalDocShell({
  title,
  eyebrow = "Legal",
  eyebrowSuffix,
  lede,
  lastUpdated,
  version,
  readingTime,
  pdfHref,
  revisionsHref,
  ribbon,
  activeLegalHref,
  docFootLabel,
  docFootLinks,
  toc,
  children,
}: LegalDocShellProps) {
  const ribbonProps: RibbonProps = ribbon ?? {
    lead: `§ Legal · ${title}`,
    middle: `Effective ${lastUpdated}`,
  };

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <Ribbon {...ribbonProps} />
      <MarketingTopNav />

      <header className="border-b-[0.5px] border-border-default px-8 pb-9 pt-16">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="flex items-center gap-[10px] text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            <span aria-hidden className="inline-block size-[5px] bg-forest" />
            <span>{eyebrow}</span>
            {eyebrowSuffix ? (
              <>
                <span aria-hidden className="font-normal opacity-50">
                  ·
                </span>
                <span>{eyebrowSuffix}</span>
              </>
            ) : null}
          </div>
          <h1 className="relative mt-[18px] text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink after:mt-[22px] after:block after:h-[1.5px] after:w-16 after:bg-gold after:content-[''] sm:text-[52px] lg:text-[64px]">
            {title}
          </h1>
          {lede ? (
            <p className="mt-[22px] max-w-[680px] text-[16px] leading-[1.55] text-subtle sm:text-[18px]">
              {lede}
            </p>
          ) : null}
          <div className="mt-[26px] flex flex-wrap items-center gap-[18px] font-mono text-[11.5px] tracking-[0.04em] text-subtle">
            <span className="text-[10px] uppercase tracking-[0.1em] text-muted">
              Effective
            </span>
            <span className="text-ink-warm">{lastUpdated}</span>
            {version ? (
              <>
                <span aria-hidden className="opacity-35">
                  ·
                </span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted">
                  Version
                </span>
                <span className="text-ink-warm">{version}</span>
              </>
            ) : null}
            {readingTime ? (
              <>
                <span aria-hidden className="opacity-35">
                  ·
                </span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted">
                  Reading time
                </span>
                <span className="text-ink-warm">{readingTime}</span>
              </>
            ) : null}
            {(pdfHref || revisionsHref) && (
              <span className="flex flex-wrap gap-2 sm:ml-auto">
                {pdfHref ? (
                  <Link
                    href={pdfHref}
                    className="inline-flex items-center gap-[6px] rounded-sm border-[0.5px] border-border-default bg-card-warm px-[11px] py-[6px] font-mono text-[11px] tracking-[0.04em] text-ink-warm transition-colors hover:border-forest hover:bg-card"
                  >
                    <Download size={12} strokeWidth={1.5} aria-hidden />
                    <span>PDF</span>
                  </Link>
                ) : null}
                {revisionsHref ? (
                  <Link
                    href={revisionsHref}
                    className="inline-flex items-center gap-[6px] rounded-sm border-[0.5px] border-border-default bg-card-warm px-[11px] py-[6px] font-mono text-[11px] tracking-[0.04em] text-ink-warm transition-colors hover:border-forest hover:bg-card"
                  >
                    <ArrowUpRight size={12} strokeWidth={1.5} aria-hidden />
                    <span>Revisions</span>
                  </Link>
                ) : null}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="px-8 pb-24 pt-12">
        <div className="mx-auto grid w-full max-w-[1200px] items-start gap-8 lg:grid-cols-[240px_1fr] lg:gap-16">
          <aside className="lg:sticky lg:top-24 lg:self-start lg:border-t-[0.5px] lg:border-border-default lg:pt-5">
            <div className="rounded-lg border-[0.5px] border-border-soft bg-card-warm p-5 lg:rounded-none lg:border-none lg:bg-transparent lg:p-0">
              <div className="mb-[14px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Contents
              </div>
              <LegalTocScrollspy items={toc} />
            </div>
          </aside>

          <article className={styles.content}>
            {children}
            {(docFootLabel || (docFootLinks && docFootLinks.length > 0)) && (
              <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border-default pt-7 font-mono text-[11.5px] tracking-[0.04em] text-subtle">
                {docFootLabel ? <span>{docFootLabel}</span> : <span />}
                {docFootLinks && docFootLinks.length > 0 ? (
                  <div className="flex gap-[14px]">
                    {docFootLinks.map((link) => (
                      <Link
                        key={`${link.label}-${link.href}`}
                        href={link.href}
                        className="text-ink-warm transition-colors hover:text-forest"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </article>
        </div>
      </div>

      <SiteFooter activeLegalHref={activeLegalHref} />
    </div>
  );
}
