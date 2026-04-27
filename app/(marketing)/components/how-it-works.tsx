import { gridPattern, dotPattern } from "./styles";

export function HowItWorks() {
  return (
    <div id="how-it-works" className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
      background: `
        radial-gradient(ellipse 100% 80% at 50% 100%, oklch(0.90 0.05 230 / 0.15) 0%, transparent 50%),
        linear-gradient(180deg, oklch(0.975 0.006 230) 0%, oklch(0.96 0.008 230) 100%)
      `
    }}>
      <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: gridPattern }} />
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: dotPattern }} />
      <div className="relative mx-auto max-w-[1120px]">
        <div className="mb-10 text-center sm:mb-14 lg:mb-16">
          <div className="mb-3 inline-flex items-center rounded-full border border-[oklch(0.88_0.04_230)] bg-white px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.40_0.08_230)] sm:text-[0.75rem]">
            <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            How it works
          </div>
          <div className="mb-3 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-4 sm:text-[1.8rem] lg:text-[2.2rem]">Get started in minutes.</div>
          <p className="mx-auto max-w-[520px] text-[0.9rem] leading-[1.7] text-[oklch(0.50_0.02_230)] sm:text-[1rem]">From signup to your first order — Fluxora guides you every step of the way.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
          {[
            { num: "01", title: "Create your workspace", desc: "Sign up and we'll provision a dedicated environment for your team in seconds.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
            { num: "02", title: "Import your catalog", desc: "Add products, customers, and suppliers via CSV or API. We'll map everything.", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
            { num: "03", title: "Start processing orders", desc: "Begin creating orders, receiving inventory, and generating invoices.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
          ].map((step, i) => (
            <div key={step.num} className="relative overflow-hidden rounded-xl border border-[oklch(0.90_0.02_230)] bg-white p-6 shadow-sm sm:rounded-2xl sm:p-8">
              <div className="pointer-events-none absolute right-2 top-2 text-[3.5rem] font-extrabold leading-none tracking-tighter text-[oklch(0.95_0.01_230)] sm:right-4 sm:top-4 sm:text-[5rem]">{step.num}</div>
              <div className="relative">
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg sm:mb-5 sm:size-12 sm:rounded-xl" style={{ background: `linear-gradient(135deg, oklch(0.${35 + i * 5} 0.10 ${230 - i * 20}), oklch(0.${45 + i * 5} 0.12 ${210 - i * 20}))` }}>
                  <svg className="size-5 text-white sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={step.icon} /></svg>
                </div>
                <div className="mb-1.5 text-[1rem] font-bold text-[oklch(0.20_0.03_230)] sm:mb-2 sm:text-[1.1rem]">{step.title}</div>
                <p className="text-[0.85rem] leading-relaxed text-[oklch(0.50_0.02_230)] sm:text-[0.9rem]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
