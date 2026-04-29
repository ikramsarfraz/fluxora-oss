import Link from "next/link";

import { dotPattern, diagonalLinesPattern } from "./styles";

export function Footer() {
  return (
    <footer
      className="relative border-t border-[oklch(0.90_0.02_230)] px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
      style={{ background: "oklch(0.98 0.005 230)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: dotPattern }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{ backgroundImage: diagonalLinesPattern }}
      />

      <div className="relative mx-auto max-w-[960px]">
        <div className="flex flex-col gap-10 sm:gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="max-w-[280px] shrink-0">
            <div className="mb-4 flex items-center gap-2.5">
              <div
                className="flex size-7 items-center justify-center rounded-lg text-[0.65rem] font-extrabold"
                style={{ background: "oklch(0.35 0.10 230)", color: "white" }}
              >
                Fx
              </div>
              <span className="text-[0.95rem] font-bold text-[oklch(0.25_0.03_230)]">
                Fluxora
              </span>
            </div>
            <p className="text-[0.82rem] leading-relaxed text-[oklch(0.50_0.02_230)]">
              The modern ERP platform built for distribution teams. Run your entire
              operation from one workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10 lg:max-w-xl lg:flex-1">
            <div>
              <div className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.02_230)] sm:mb-4">
                Product
              </div>
              <div className="flex flex-col gap-2 text-[0.85rem] text-[oklch(0.50_0.02_230)] sm:gap-2.5">
                <Link
                  href="/changelog"
                  className="transition-colors hover:text-[oklch(0.30_0.03_230)]"
                >
                  Changelog
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.02_230)] sm:mb-4">
                Legal
              </div>
              <div className="flex flex-col gap-2 text-[0.85rem] text-[oklch(0.50_0.02_230)] sm:gap-2.5">
                <Link href="/privacy" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
                  Privacy
                </Link>
                <Link href="/terms" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
                  Terms
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.02_230)] sm:mb-4">
                Account
              </div>
              <div className="flex flex-col gap-2 text-[0.85rem] text-[oklch(0.50_0.02_230)] sm:gap-2.5">
                <Link href="/login" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
                  Login
                </Link>
                <Link href="/signup" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-[oklch(0.90_0.02_230)] pt-8 sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pt-10">
          <div className="flex flex-col gap-1">
            <div className="text-[0.78rem] text-[oklch(0.50_0.02_230)] sm:text-[0.8rem]">
              © 2026 Fluxora, Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-1.5 text-[0.72rem] text-[oklch(0.55_0.02_230)] sm:text-[0.75rem]">
              Built by
              <a
                href="https://pelzersolutions.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[oklch(0.45_0.12_195)] transition-colors hover:text-[oklch(0.35_0.14_195)]"
              >
                Pelzer Solutions
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
