import Link from "next/link";
import { Button } from "@/components/ui/button";
import { gridPattern, crossPattern } from "./styles";

export function CTA() {
  return (
    <div className="relative overflow-hidden px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8 lg:py-28" style={{ 
      background: `
        radial-gradient(ellipse 100% 80% at 50% 100%, oklch(0.92 0.05 230 / 0.3) 0%, transparent 50%),
        linear-gradient(180deg, oklch(0.97 0.006 230) 0%, oklch(0.94 0.01 230) 100%)
      `
    }}>
      {/* Grid and cross patterns */}
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: gridPattern }} />
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: crossPattern }} />
      
      <div className="relative mx-auto max-w-[680px]">
        <h2 className="mb-4 text-balance text-[1.5rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-[oklch(0.18_0.04_230)] sm:mb-5 sm:text-[2rem] lg:text-[2.8rem]">
          Supercharge your<br className="hidden sm:block" /> distribution operation.
        </h2>
        <p className="mb-8 text-pretty text-[0.9rem] leading-[1.7] text-[oklch(0.45_0.02_230)] sm:mb-10 sm:text-[1rem] lg:text-[1.1rem] lg:leading-[1.75]">
          Join hundreds of teams who run orders, inventory, and finance on Fluxora. Free to start, no credit card required.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" className="h-11 w-full bg-[oklch(0.35_0.10_230)] px-6 text-[0.9rem] font-semibold text-white shadow-lg hover:bg-[oklch(0.40_0.10_230)] sm:h-12 sm:w-auto sm:px-7 sm:text-[0.95rem]">
            <Link href="/signup">
              Start your free trial
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16" className="ml-2"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 w-full border-[oklch(0.85_0.03_230)] bg-white px-6 text-[0.9rem] font-semibold text-[oklch(0.30_0.05_230)] hover:bg-[oklch(0.97_0.005_230)] sm:h-12 sm:w-auto sm:px-7 sm:text-[0.95rem]">
            <a href="#">Request a demo</a>
          </Button>
        </div>
        <p className="mt-4 text-[0.78rem] text-[oklch(0.55_0.02_230)] sm:mt-5 sm:text-[0.82rem]">Free during early access · No credit card · Cancel anytime</p>
      </div>
    </div>
  );
}
