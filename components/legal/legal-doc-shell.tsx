import Link from "next/link";

import { AuthBrand } from "@/app/(auth)/components/auth-shell";

const gridPattern = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

export type LegalTocItem = { id: string; label: string };

type LegalDocShellProps = {
  title: string;
  lastUpdated: string;
  toc: LegalTocItem[];
  children: React.ReactNode;
};

export function LegalDocShell({
  title,
  lastUpdated,
  toc,
  children,
}: LegalDocShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[oklch(0.99_0.003_230)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: gridPattern }}
      />
      <header className="relative z-10 border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.99_0.003_230)]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <AuthBrand />
          <Link
            href="/"
            className="text-sm text-[oklch(0.50_0.02_230)] transition-colors hover:text-[oklch(0.30_0.03_230)]"
          >
            Home
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="mb-10 space-y-2 border-b border-border pb-8">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-[oklch(0.22_0.03_230)] sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">Effective / last updated: {lastUpdated}</p>
          <nav
            aria-label="On this page"
            className="mt-6 flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-4 sm:p-5"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              On this page
            </span>
            <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
              {toc.map(item => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-[oklch(0.40_0.08_195)] underline-offset-4 transition-colors hover:text-[oklch(0.35_0.12_195)] hover:underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <article className="space-y-12 text-[0.9375rem] leading-relaxed [&_strong]:font-semibold [&_a]:underline-offset-4 [&_section]:scroll-mt-[6.5rem] [&_section]:space-y-3 [&_h2]:scroll-mt-[6.5rem] [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_p]:leading-relaxed [&_p]:text-foreground [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:leading-relaxed [&_li]:text-foreground">
          {children}
        </article>
      </div>
    </div>
  );
}
