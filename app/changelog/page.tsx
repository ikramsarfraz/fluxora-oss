import type { Metadata } from "next";
import Link from "next/link";

import { AuthBrand } from "@/app/(auth)/components/auth-shell";
import { Badge } from "@/components/ui/badge";
import {
  type ChangelogRelease,
  type ChangelogSectionKind,
  changelogReleases,
} from "@/lib/changelog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Changelog · Fluxora",
  description: "Product updates, improvements, and fixes for the Fluxora ERP platform.",
};

const gridPattern = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

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

const SECTION_BADGE_CLASS: Record<ChangelogSectionKind, string> = {
  added:
    "border-emerald-600/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  improved: "border-sky-600/25 bg-sky-500/10 text-sky-900 dark:text-sky-100",
  fixed: "border-amber-600/30 bg-amber-500/10 text-amber-950 dark:text-amber-50",
  security:
    "border-violet-600/25 bg-violet-500/10 text-violet-950 dark:text-violet-50",
};

function ReleaseCard({ release }: { release: ChangelogRelease }) {
  const sectionKeys = SECTION_ORDER.filter(k => {
    const entries = release.sections[k];
    return entries && entries.length > 0;
  });

  return (
    <article
      className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8"
      aria-labelledby={`changelog-${release.version}`}
    >
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
            {release.version}
          </span>
          <span className="text-sm text-muted-foreground">{release.dateLabel}</span>
        </div>
        <h2
          id={`changelog-${release.version}`}
          className="text-xl font-semibold tracking-tight text-[oklch(0.22_0.03_230)] sm:text-2xl"
        >
          {release.title}
        </h2>
        <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">
          {release.summary}
        </p>
      </header>

      {sectionKeys.length > 0 ? (
        <div className="mt-8 space-y-8">
          {sectionKeys.map(kind => (
            <section key={kind} aria-labelledby={`${release.version}-${kind}`}>
              <div className="mb-3 flex items-center gap-2">
                <Badge
                  id={`${release.version}-${kind}`}
                  variant="outline"
                  className={cn("font-semibold", SECTION_BADGE_CLASS[kind])}
                >
                  {SECTION_LABEL[kind]}
                </Badge>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-foreground marker:text-muted-foreground">
                {release.sections[kind]?.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function ChangelogPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[oklch(0.99_0.003_230)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: gridPattern }}
      />
      <header className="relative z-10 border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.99_0.003_230)]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <AuthBrand />
          <nav className="flex items-center gap-4 text-sm text-[oklch(0.50_0.02_230)]">
            <Link
              href="/"
              className="transition-colors hover:text-[oklch(0.30_0.03_230)]"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="font-medium text-[oklch(0.55_0.15_195)] transition-colors hover:text-[oklch(0.45_0.15_195)]"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        <div className="mb-12 space-y-3">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-[oklch(0.22_0.03_230)] sm:text-4xl">
            Changelog
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Highlights from Fluxora releases—features we ship, rough edges we smooth, and
            operational notes worth knowing about. Newest first.
          </p>
        </div>

        <div className="space-y-12">
          {changelogReleases.map(release => (
            <ReleaseCard key={release.version} release={release} />
          ))}
        </div>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            ← Back to home
          </Link>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
