import Link from "next/link";

import { dotPattern, diagonalLinesPattern } from "./styles";

export function Footer() {
  return (
    <footer className="relative border-t border-[oklch(0.90_0.02_230)] px-4 py-10 sm:px-6 sm:py-12 lg:px-8" style={{ background: "oklch(0.98 0.005 230)" }}>
      {/* Subtle patterns */}
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: dotPattern }} />
      <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: diagonalLinesPattern }} />
      
      <div className="relative mx-auto max-w-[1120px]">
        <div className="flex flex-col gap-10 sm:gap-12 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[280px]">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg text-[0.65rem] font-extrabold" style={{ background: "oklch(0.35 0.10 230)", color: "white" }}>Fx</div>
              <span className="text-[0.95rem] font-bold text-[oklch(0.25_0.03_230)]">Fluxora</span>
            </div>
            <p className="text-[0.82rem] leading-relaxed text-[oklch(0.50_0.02_230)]">
              The modern ERP platform built for distribution teams. Run your entire operation from one workspace.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12 lg:gap-16">
            <div>
              <div className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.02_230)] sm:mb-4">Product</div>
              <div className="flex flex-col gap-2 text-[0.85rem] text-[oklch(0.50_0.02_230)] sm:gap-2.5">
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">Features</a>
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">Pricing</a>
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">Integrations</a>
                <Link href="/changelog" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
                  Changelog
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.02_230)] sm:mb-4">Resources</div>
              <div className="flex flex-col gap-2 text-[0.85rem] text-[oklch(0.50_0.02_230)] sm:gap-2.5">
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">Documentation</a>
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">API Reference</a>
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">Blog</a>
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">Support</a>
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.02_230)] sm:mb-4">Company</div>
              <div className="flex flex-col gap-2 text-[0.85rem] text-[oklch(0.50_0.02_230)] sm:gap-2.5">
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">About</a>
                <a href="#" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">Careers</a>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-10 space-y-6 border-t border-[oklch(0.90_0.02_230)] pt-8 sm:mt-12 sm:space-y-8 sm:pt-10">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[0.85rem] text-[oklch(0.50_0.02_230)]">
            <Link
              href="/changelog"
              className="font-medium transition-colors hover:text-[oklch(0.30_0.03_230)]"
            >
              Changelog
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
              Terms
            </Link>
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex items-center gap-4 sm:gap-5">
              <a href="#" className="text-[oklch(0.50_0.02_230)] transition-colors hover:text-[oklch(0.30_0.03_230)]">
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-[oklch(0.50_0.02_230)] transition-colors hover:text-[oklch(0.30_0.03_230)]">
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a href="#" className="text-[oklch(0.50_0.02_230)] transition-colors hover:text-[oklch(0.30_0.03_230)]">
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
