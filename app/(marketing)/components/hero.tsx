import Link from "next/link";
import { gradStyle, primaryBtn, primaryBtnHover, gridPattern } from "./styles";

export function Hero() {
  return (
    <div className="relative overflow-hidden" style={{ 
      background: `
        radial-gradient(ellipse 100% 80% at 50% -20%, oklch(0.92 0.04 230 / 0.6) 0%, transparent 60%),
        radial-gradient(ellipse 80% 50% at 100% 0%, oklch(0.90 0.06 195 / 0.4) 0%, transparent 50%),
        radial-gradient(ellipse 60% 40% at 0% 30%, oklch(0.94 0.03 230 / 0.3) 0%, transparent 50%),
        linear-gradient(180deg, oklch(0.985 0.005 230) 0%, white 100%)
      `
    }}>
      {/* Background grid pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: gridPattern }} />

      {/* Announcement - hidden on small screens */}
      <div className="relative hidden justify-center px-4 pt-8 sm:flex sm:px-6 sm:pt-12 lg:px-8">
        <a href="#" className="group inline-flex items-center gap-2 rounded-full border border-[oklch(0.88_0.02_230)] bg-white/80 px-3 py-1.5 text-[0.75rem] shadow-sm backdrop-blur-sm transition-all hover:border-[oklch(0.80_0.04_230)] hover:shadow-md sm:gap-2.5 sm:px-4 sm:text-[0.8rem]">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, oklch(0.50 0.14 230), oklch(0.55 0.15 195))" }}>
            <svg width="10" height="10" fill="none" viewBox="0 0 10 10"><path d="M5 1.5v4l2.5 1.25" stroke="white" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </div>
          <span className="shrink-0 rounded-full bg-[oklch(0.55_0.15_195)] px-2 py-0.5 text-[0.68rem] font-semibold tracking-wide text-white">NEW</span>
          <span className="hidden sm:inline">Catch-weight lot tracking now in early access</span>
          <span className="sm:hidden">Lot tracking in early access</span>
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </a>
      </div>

      {/* Hero content */}
      <div className="relative mx-auto max-w-[860px] px-4 pb-12 pt-10 text-center sm:px-6 sm:pb-16 sm:pt-14 lg:px-8">
        <h1 className="mb-4 text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] sm:mb-6 sm:text-[2.5rem] md:text-[3rem] lg:text-[3.5rem] xl:text-[4.2rem]">
          Run every operation<br className="hidden sm:block" />
          <span className="sm:hidden"> </span>from <span style={gradStyle}>one workspace.</span>
        </h1>
        <p className="mx-auto mb-8 max-w-[560px] text-pretty text-[0.95rem] leading-[1.7] text-[oklch(0.45_0.02_230)] sm:mb-10 sm:text-[1.1rem] sm:leading-[1.75]">
          Fluxora connects your sales orders, receiving, inventory, invoicing, and payments in one tenant-isolated platform built for distribution teams.
        </p>
        <div className="mb-4 flex flex-col items-center justify-center gap-3 sm:mb-6 sm:flex-row">
          <Link href="/signup" className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-6 text-[0.9rem] font-semibold text-white shadow-md transition-all hover:shadow-lg sm:w-auto ${primaryBtnHover}`} style={primaryBtn}>
            Start your free trial
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <a href="#how-it-works" className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-[oklch(0.85_0.02_230)] bg-white px-6 text-[0.9rem] font-semibold text-[oklch(0.30_0.05_230)] shadow-sm transition-all hover:border-[oklch(0.75_0.04_230)] hover:bg-[oklch(0.98_0.005_230)] sm:w-auto">
            See how it works
          </a>
        </div>
        <p className="text-[0.78rem] text-[oklch(0.55_0.02_230)] sm:text-[0.82rem]">No credit card required · Free for 14 days · Cancel anytime</p>
      </div>

      {/* Dashboard visual - hidden on mobile, simplified on tablet */}
      <HeroDashboard />
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="relative mx-auto hidden max-w-[1120px] px-4 pb-16 sm:block sm:px-6 sm:pb-24 lg:px-8">
      {/* Glow effect behind dashboard */}
      <div className="absolute inset-x-4 top-8 -z-10 h-[400px] rounded-[32px] opacity-50 sm:inset-x-6 lg:inset-x-8" style={{ background: "linear-gradient(135deg, oklch(0.85 0.06 230 / 0.4) 0%, oklch(0.88 0.05 195 / 0.3) 100%)", filter: "blur(60px)" }} />
      
      <div className="overflow-hidden rounded-xl border border-[oklch(0.90_0.01_230)] bg-white shadow-[0_4px_6px_oklch(0_0_0/0.03),0_24px_80px_oklch(0.30_0.05_230/0.12)] sm:rounded-2xl">
        {/* browser bar */}
        <div className="flex items-center gap-3 border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.975_0.005_230)] px-3 py-2 sm:px-5 sm:py-3">
          <div className="flex gap-1.5 sm:gap-2">
            <div className="size-2.5 rounded-full bg-[oklch(0.70_0.18_25)] sm:size-3" />
            <div className="size-2.5 rounded-full bg-[oklch(0.78_0.16_85)] sm:size-3" />
            <div className="size-2.5 rounded-full bg-[oklch(0.70_0.17_150)] sm:size-3" />
          </div>
          <div className="mx-auto hidden h-7 max-w-[340px] flex-1 items-center rounded-md border border-[oklch(0.90_0.01_230)] bg-white px-3 font-mono text-[0.73rem] text-[oklch(0.50_0.02_230)] md:flex">
            <svg className="mr-2 size-3.5 text-[oklch(0.65_0.02_230)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            acme-foods.fluxora.app/dashboard
          </div>
        </div>
        {/* app body */}
        <div className="flex min-h-[320px] sm:min-h-[400px] lg:min-h-[480px]">
          {/* sidebar - hidden on smaller screens */}
          <div className="hidden w-[180px] shrink-0 flex-col gap-1 border-r border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.003_230)] px-3 py-4 lg:flex lg:w-[210px] lg:px-4 lg:py-5">
            {[
              { label: "Operations", items: [
                { name: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
                { name: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                { name: "Receiving", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
                { name: "Inventory", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" }
              ]},
              { label: "Finance", items: [
                { name: "Invoices", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                { name: "Payments", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
              ]},
            ].map(group => (
              <div key={group.label}>
                <div className="mb-1.5 mt-3 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[oklch(0.55_0.02_230)] lg:text-[0.65rem]">{group.label}</div>
                {group.items.map((item, i) => (
                  <div key={item.name} className={`flex cursor-default items-center gap-2 rounded-lg px-3 py-1.5 text-[0.75rem] lg:gap-2.5 lg:py-2 lg:text-[0.8rem] ${i === 0 && group.label === "Operations" ? "bg-white font-medium text-[oklch(0.25_0.05_230)] shadow-sm" : "text-[oklch(0.50_0.02_230)]"}`}>
                    <svg className="size-3.5 lg:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                    {item.name}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* main */}
          <div className="flex-1 bg-white p-4 sm:p-5 lg:p-7">
            <div className="mb-4 flex items-start justify-between sm:mb-5 lg:mb-7">
              <div>
                <div className="text-[0.95rem] font-bold tracking-[-0.02em] text-[oklch(0.20_0.03_230)] sm:text-[1rem] lg:text-[1.15rem]">Dashboard</div>
                <div className="mt-0.5 text-[0.7rem] text-[oklch(0.55_0.02_230)] sm:mt-1 sm:text-[0.78rem]">ACME Foods · April 2026</div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-8 items-center rounded-lg border border-[oklch(0.90_0.01_230)] bg-white px-3 text-[0.75rem] text-[oklch(0.50_0.02_230)] lg:h-9 lg:text-[0.78rem]">
                  <svg className="mr-2 size-3.5 lg:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Search...
                </div>
                <div className="flex h-8 items-center rounded-lg px-3 text-[0.75rem] font-semibold text-white shadow-sm lg:h-9 lg:px-4 lg:text-[0.8rem]" style={{ background: "oklch(0.35 0.10 230)" }}>+ New order</div>
              </div>
            </div>
            {/* stats */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-4 lg:mb-7 lg:grid-cols-4">
              {[
                { label: "Revenue (MTD)", val: "$128k", badge: "↑ 12.5%", badgeCls: "bg-[oklch(0.94_0.04_165)] text-[oklch(0.45_0.12_165)]", iconBg: "oklch(0.94 0.04 165)", iconColor: "oklch(0.45 0.12 165)" },
                { label: "Open orders", val: "47", badge: "4 pending", badgeCls: "bg-[oklch(0.94_0.04_85)] text-[oklch(0.50_0.14_85)]", iconBg: "oklch(0.94 0.04 85)", iconColor: "oklch(0.50 0.14 85)" },
                { label: "Invoiced", val: "$94k", badge: "532 inv", badgeCls: "bg-[oklch(0.93_0.03_230)] text-[oklch(0.40_0.10_230)]", iconBg: "oklch(0.93 0.03 230)", iconColor: "oklch(0.40 0.10 230)" },
                { label: "Overdue", val: "$8.2k", badge: "3 aging", badgeCls: "bg-[oklch(0.95_0.04_25)] text-[oklch(0.50_0.18_25)]", iconBg: "oklch(0.95 0.04 25)", iconColor: "oklch(0.50 0.18 25)" },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-[oklch(0.92_0.01_230)] bg-white p-3 lg:rounded-xl lg:p-4">
                  <div className="mb-1.5 flex items-center justify-between lg:mb-2">
                    <div className="text-[0.65rem] font-medium text-[oklch(0.55_0.02_230)] lg:text-[0.72rem]">{s.label}</div>
                    <div className="hidden size-6 items-center justify-center rounded-md sm:flex lg:size-8 lg:rounded-lg" style={{ background: s.iconBg }}>
                      <div className="size-1 rounded-full lg:size-1.5" style={{ background: s.iconColor }} />
                    </div>
                  </div>
                  <div className="text-[1.1rem] font-bold tracking-[-0.03em] text-[oklch(0.20_0.03_230)] sm:text-[1.25rem] lg:text-[1.5rem]">{s.val}</div>
                  <span className={`mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold lg:mt-2 lg:px-2 lg:text-[0.67rem] ${s.badgeCls}`}>{s.badge}</span>
                </div>
              ))}
            </div>
            {/* table - simplified for tablet */}
            <div className="hidden overflow-hidden rounded-lg border border-[oklch(0.92_0.01_230)] sm:block lg:rounded-xl">
              <div className="grid border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.003_230)] px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.55_0.02_230)] lg:px-4 lg:py-3 lg:text-[0.7rem]" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr" }}>
                <span>Order</span><span>Customer</span><span>Total</span><span>Status</span>
              </div>
              {[
                { id: "ORD-1248", cust: "Metro Mart", amt: "$4,200", status: "Fulfilled", cls: "bg-[oklch(0.94_0.04_165)] text-[oklch(0.45_0.12_165)]" },
                { id: "ORD-1247", cust: "Fresh Co.", amt: "$1,890", status: "Invoiced", cls: "bg-[oklch(0.93_0.03_230)] text-[oklch(0.40_0.10_230)]" },
                { id: "ORD-1246", cust: "City Foods", amt: "$3,100", status: "Pending", cls: "bg-[oklch(0.94_0.04_85)] text-[oklch(0.50_0.14_85)]" },
                { id: "ORD-1245", cust: "Park Deli", amt: "$750", status: "Fulfilled", cls: "bg-[oklch(0.94_0.04_165)] text-[oklch(0.45_0.12_165)]" },
              ].map((row, i, arr) => (
                <div key={row.id} className={`grid items-center px-3 py-2 text-[0.75rem] lg:px-4 lg:py-3 lg:text-[0.8rem] ${i < arr.length - 1 ? "border-b border-[oklch(0.94_0.01_230)]" : ""}`} style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr" }}>
                  <span className="font-medium text-[oklch(0.25_0.03_230)]">{row.id}</span>
                  <span className="text-[oklch(0.50_0.02_230)]">{row.cust}</span>
                  <span className="font-medium text-[oklch(0.35_0.03_230)]">{row.amt}</span>
                  <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-[0.6rem] font-semibold lg:px-2.5 lg:py-1 lg:text-[0.68rem] ${row.cls}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
