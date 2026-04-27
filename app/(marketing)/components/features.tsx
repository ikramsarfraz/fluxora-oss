import { gridPattern, dotPattern, crossPattern, diagonalLinesPattern } from "./styles";

export function Features() {
  return (
    <>
      {/* ── FEATURE 1: Orders ── */}
      <div id="features" className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
        background: `
          linear-gradient(180deg, white 0%, oklch(0.98 0.005 230) 50%, white 100%),
          radial-gradient(ellipse 100% 80% at 0% 50%, oklch(0.94 0.04 230 / 0.2) 0%, transparent 60%)
        `
      }}>
        <div className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: gridPattern }} />
        <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: crossPattern }} />
        <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div className="order-2 lg:order-1">
            <div className="mb-3 inline-flex items-center rounded-full border border-[oklch(0.88_0.04_230)] bg-[oklch(0.96_0.02_230)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.40_0.08_230)] sm:text-[0.75rem]">
              <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Sales orders
            </div>
            <div className="mb-4 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-5 sm:text-[1.8rem] lg:text-[2.2rem]">From quote to<br className="hidden sm:block" /> fulfilled — in one flow.</div>
            <p className="text-[0.9rem] leading-[1.7] text-[oklch(0.45_0.02_230)] sm:text-[1rem] lg:text-[1.05rem] lg:leading-[1.75]">Create orders with line-level pricing, unit-of-measure snapshots, and fulfillment tracking. Every order connects directly to inventory and invoicing.</p>
            <div className="mt-6 flex flex-wrap gap-2 sm:mt-8">
              {["Unit-of-measure snapshots", "Fulfillment tracking", "Pricing history"].map(chip => (
                <div key={chip} className="flex items-center gap-2 rounded-full border border-[oklch(0.90_0.02_230)] bg-white px-3 py-1.5 text-[0.75rem] text-[oklch(0.40_0.03_230)] shadow-sm sm:px-3.5 sm:py-2 sm:text-[0.8rem]">
                  <div className="size-1.5 rounded-full" style={{ background: "oklch(0.55 0.15 195)" }} />
                  {chip}
                </div>
              ))}
            </div>
            <a href="#" className="mt-6 inline-flex items-center gap-2 text-[0.85rem] font-semibold text-[oklch(0.35_0.10_230)] transition-colors hover:text-[oklch(0.45_0.12_210)] sm:mt-8 sm:text-[0.9rem]">
              Explore orders 
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
          <div className="order-1 overflow-hidden rounded-xl border border-[oklch(0.88_0.02_230)] bg-white shadow-[0_4px_6px_oklch(0_0_0/0.02),0_20px_50px_oklch(0.30_0.05_230/0.1)] sm:rounded-2xl lg:order-2">
            <div className="flex items-center justify-between border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.003_230)] px-4 py-3 text-[0.72rem] font-semibold text-[oklch(0.45_0.02_230)] sm:px-5 sm:py-3.5 sm:text-[0.78rem]">
              <span>Recent orders · ACME Foods</span>
              <span className="rounded-full bg-[oklch(0.94_0.04_165)] px-2 py-0.5 text-[0.65rem] font-semibold text-[oklch(0.45_0.12_165)] sm:px-2.5 sm:py-1 sm:text-[0.7rem]">47 open</span>
            </div>
            <div className="bg-white">
              {[
                { id: "ORD-1248 · Metro Mart", sub: "24 line items · Frozen goods", amt: "$4,200", status: "Fulfilled", sCls: "bg-[oklch(0.94_0.04_165)] text-[oklch(0.45_0.12_165)]" },
                { id: "ORD-1247 · Fresh Co.", sub: "8 line items · Produce", amt: "$1,890", status: "Invoiced", sCls: "bg-[oklch(0.93_0.03_230)] text-[oklch(0.40_0.10_230)]" },
                { id: "ORD-1246 · City Foods", sub: "12 line items · Dry goods", amt: "$3,100", status: "Pending", sCls: "bg-[oklch(0.94_0.04_85)] text-[oklch(0.50_0.14_85)]" },
              ].map((row, i, arr) => (
                <div key={row.id} className={`flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 ${i < arr.length - 1 ? "border-b border-[oklch(0.94_0.01_230)]" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.78rem] font-semibold text-[oklch(0.25_0.03_230)] sm:text-[0.82rem]">{row.id}</div>
                    <div className="mt-0.5 truncate text-[0.7rem] text-[oklch(0.55_0.02_230)] sm:text-[0.75rem]">{row.sub}</div>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <div className="text-[0.85rem] font-bold text-[oklch(0.25_0.03_230)] sm:text-[0.95rem]">{row.amt}</div>
                    <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold sm:px-2 sm:text-[0.68rem] ${row.sCls}`}>{row.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FEATURE 2: Inventory ── */}
      <div className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
        background: `
          radial-gradient(ellipse 80% 60% at 100% 30%, oklch(0.92 0.05 195 / 0.2) 0%, transparent 50%),
          linear-gradient(180deg, white 0%, oklch(0.985 0.004 195) 50%, white 100%)
        `
      }}>
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: dotPattern }} />
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: diagonalLinesPattern }} />
        <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
          {/* panel first on desktop */}
          <div className="order-1 overflow-hidden rounded-xl border border-[oklch(0.88_0.03_195)] bg-white shadow-[0_4px_6px_oklch(0_0_0/0.02),0_20px_50px_oklch(0.35_0.08_195/0.1)] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.003_230)] px-4 py-3 text-[0.72rem] font-semibold text-[oklch(0.45_0.02_230)] sm:px-5 sm:py-3.5 sm:text-[0.78rem]">
              <span>Inventory · Current stock</span>
              <span className="text-[0.7rem] font-medium text-[oklch(0.55_0.02_230)] sm:text-[0.75rem]">4,218 units</span>
            </div>
            <div className="bg-white p-4 sm:p-5">
              {[
                { name: "Frozen chicken breast", qty: "840 u", pct: "82%", color: "oklch(0.50 0.14 230)" },
                { name: "Dry pasta — 1kg", qty: "1,200 u", pct: "100%", color: "oklch(0.55 0.15 195)" },
                { name: "Roma tomatoes", qty: "38 u", pct: "8%", color: "oklch(0.55 0.18 25)", qtyRed: true, warning: true },
                { name: "Sparkling water 500ml", qty: "780 u", pct: "56%", color: "oklch(0.58 0.14 85)" },
              ].map((item, i, arr) => (
                <div key={item.name} className={`${i < arr.length - 1 ? "mb-4 sm:mb-5" : ""}`}>
                  <div className="mb-1.5 flex items-center justify-between text-[0.75rem] sm:mb-2 sm:text-[0.8rem]">
                    <span className="truncate font-medium text-[oklch(0.30_0.03_230)]">{item.name}</span>
                    <span className={`ml-2 shrink-0 flex items-center gap-1 ${item.qtyRed ? "text-[oklch(0.50_0.18_25)]" : "text-[oklch(0.55_0.02_230)]"}`}>
                      {item.warning && <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                      {item.qty}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[oklch(0.95_0.01_230)] sm:h-2">
                    <div className="h-full rounded-full transition-all" style={{ width: item.pct, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="order-2">
            <div className="mb-3 inline-flex items-center rounded-full border border-[oklch(0.85_0.05_195)] bg-[oklch(0.95_0.03_195)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.40_0.10_195)] sm:text-[0.75rem]">
              <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Inventory & lots
            </div>
            <div className="mb-4 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-5 sm:text-[1.8rem] lg:text-[2.2rem]">Real-time stock with<br className="hidden sm:block" /> full lot traceability.</div>
            <p className="text-[0.9rem] leading-[1.7] text-[oklch(0.45_0.02_230)] sm:text-[1rem] lg:text-[1.05rem] lg:leading-[1.75]">Track every unit by lot number and expiration date. Inventory state updates automatically as you receive, pick, and ship.</p>
            <div className="mt-6 flex flex-wrap gap-2 sm:mt-8">
              {["Lot lineage", "Expiration alerts", "Catch-weight support"].map(chip => (
                <div key={chip} className="flex items-center gap-2 rounded-full border border-[oklch(0.88_0.03_195)] bg-white px-3 py-1.5 text-[0.75rem] text-[oklch(0.40_0.06_195)] shadow-sm sm:px-3.5 sm:py-2 sm:text-[0.8rem]">
                  <div className="size-1.5 rounded-full" style={{ background: "oklch(0.55 0.15 195)" }} />
                  {chip}
                </div>
              ))}
            </div>
            <a href="#" className="mt-6 inline-flex items-center gap-2 text-[0.85rem] font-semibold text-[oklch(0.40_0.12_195)] transition-colors hover:text-[oklch(0.50_0.14_195)] sm:mt-8 sm:text-[0.9rem]">
              Explore inventory 
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </div>

      {/* ── FEATURE 3: Finance ── */}
      <div className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
        background: `
          radial-gradient(ellipse 70% 50% at 30% 20%, oklch(0.94 0.04 85 / 0.15) 0%, transparent 50%),
          linear-gradient(180deg, white 0%, oklch(0.985 0.004 85) 50%, white 100%)
        `
      }}>
        <div className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: gridPattern }} />
        <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: crossPattern }} />
        <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div className="order-2 lg:order-1">
            <div className="mb-3 inline-flex items-center rounded-full border border-[oklch(0.88_0.05_85)] bg-[oklch(0.96_0.03_85)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.12_85)] sm:text-[0.75rem]">
              <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Invoicing & payments
            </div>
            <div className="mb-4 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-5 sm:text-[1.8rem] lg:text-[2.2rem]">Finance-ready<br className="hidden sm:block" /> from day one.</div>
            <p className="text-[0.9rem] leading-[1.7] text-[oklch(0.45_0.02_230)] sm:text-[1rem] lg:text-[1.05rem] lg:leading-[1.75]">Generate invoices from fulfilled orders, record payments, and track COGS and gross margin — all wired into the same workflow as operations.</p>
            <div className="mt-6 flex flex-wrap gap-2 sm:mt-8">
              {["COGS tracking", "Gross margin", "AR aging"].map(chip => (
                <div key={chip} className="flex items-center gap-2 rounded-full border border-[oklch(0.90_0.03_85)] bg-white px-3 py-1.5 text-[0.75rem] text-[oklch(0.45_0.08_85)] shadow-sm sm:px-3.5 sm:py-2 sm:text-[0.8rem]">
                  <div className="size-1.5 rounded-full" style={{ background: "oklch(0.58 0.14 85)" }} />
                  {chip}
                </div>
              ))}
            </div>
            <a href="#" className="mt-6 inline-flex items-center gap-2 text-[0.85rem] font-semibold text-[oklch(0.45_0.12_85)] transition-colors hover:text-[oklch(0.55_0.14_85)] sm:mt-8 sm:text-[0.9rem]">
              Explore finance 
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
          <div className="order-1 overflow-hidden rounded-xl border border-[oklch(0.88_0.04_85)] bg-white shadow-[0_4px_6px_oklch(0_0_0/0.02),0_20px_50px_oklch(0.40_0.10_85/0.08)] sm:rounded-2xl lg:order-2">
            <div className="flex items-center justify-between border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.003_230)] px-4 py-3 text-[0.72rem] font-semibold text-[oklch(0.45_0.02_230)] sm:px-5 sm:py-3.5 sm:text-[0.78rem]">
              <span>Invoices · Outstanding</span>
              <span className="text-[0.7rem] font-semibold text-[oklch(0.50_0.18_25)] sm:text-[0.75rem]">$8,240 overdue</span>
            </div>
            <div className="space-y-2 bg-white p-4 sm:space-y-3 sm:p-5">
              {[
                { title: "INV-0892 · Metro Mart", date: "Issued Apr 20 · Net 30", amt: "$4,200", status: "Paid", sCls: "bg-[oklch(0.94_0.04_165)] text-[oklch(0.45_0.12_165)]" },
                { title: "INV-0891 · Fresh Co.", date: "Issued Apr 18 · Net 15", amt: "$1,890", status: "Overdue", sCls: "bg-[oklch(0.95_0.04_25)] text-[oklch(0.50_0.18_25)]" },
                { title: "INV-0890 · Harbor Bros.", date: "Issued Apr 15 · Net 30", amt: "$6,400", status: "Pending", sCls: "bg-[oklch(0.94_0.04_85)] text-[oklch(0.50_0.14_85)]" },
              ].map((inv) => (
                <div key={inv.title} className="rounded-lg border border-[oklch(0.92_0.01_230)] p-3 sm:rounded-xl sm:p-4">
                  <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.8rem] font-semibold text-[oklch(0.25_0.03_230)] sm:text-[0.85rem]">{inv.title}</div>
                      <div className="mt-0.5 text-[0.7rem] text-[oklch(0.55_0.02_230)] sm:text-[0.75rem]">{inv.date}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold sm:px-2.5 sm:py-1 sm:text-[0.68rem] ${inv.sCls}`}>{inv.status}</span>
                  </div>
                  <div className="text-[1rem] font-bold tracking-[-0.02em] text-[oklch(0.20_0.03_230)] sm:text-[1.1rem]">{inv.amt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <InvoiceFeature />
      <EmailFeature />
    </>
  );
}

function InvoiceFeature() {
  return (
    <div className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
      background: `
        radial-gradient(ellipse 80% 60% at 0% 40%, oklch(0.92 0.05 230 / 0.15) 0%, transparent 50%),
        linear-gradient(180deg, white 0%, oklch(0.985 0.004 230) 50%, white 100%)
      `
    }}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: dotPattern }} />
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: diagonalLinesPattern }} />
      <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
        {/* panel first on desktop */}
        <div className="order-1 overflow-hidden rounded-xl border border-[oklch(0.88_0.03_230)] bg-white shadow-[0_4px_6px_oklch(0_0_0/0.02),0_20px_50px_oklch(0.35_0.08_230/0.1)] sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.003_230)] px-4 py-3 text-[0.72rem] font-semibold text-[oklch(0.45_0.02_230)] sm:px-5 sm:py-3.5 sm:text-[0.78rem]">
            <span>Invoice Generation</span>
            <span className="rounded-full bg-[oklch(0.94_0.04_165)] px-2 py-0.5 text-[0.65rem] font-semibold text-[oklch(0.45_0.12_165)] sm:px-2.5 sm:py-1 sm:text-[0.7rem]">Auto-generate</span>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <div className="rounded-lg border border-[oklch(0.92_0.01_230)] bg-[oklch(0.99_0.002_230)] p-4 sm:rounded-xl sm:p-5">
              <div className="mb-3 flex items-start justify-between sm:mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg text-[0.5rem] font-extrabold sm:size-8 sm:text-[0.55rem]" style={{ background: "linear-gradient(135deg, oklch(0.35 0.10 230), oklch(0.45 0.12 210))", color: "white" }}>Fx</div>
                    <span className="text-[0.8rem] font-bold text-[oklch(0.25_0.03_230)] sm:text-[0.85rem]">INVOICE</span>
                  </div>
                  <div className="mt-1.5 text-[0.68rem] text-[oklch(0.55_0.02_230)] sm:mt-2 sm:text-[0.72rem]">INV-0893</div>
                </div>
                <div className="text-right text-[0.68rem] text-[oklch(0.55_0.02_230)] sm:text-[0.72rem]">
                  <div>Date: Apr 26, 2026</div>
                  <div>Due: May 26, 2026</div>
                </div>
              </div>
              <div className="mb-3 border-t border-dashed border-[oklch(0.90_0.01_230)] pt-3 sm:mb-4 sm:pt-4">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-[oklch(0.55_0.02_230)] sm:text-[0.7rem]">Bill To</div>
                <div className="mt-1 text-[0.75rem] font-medium text-[oklch(0.30_0.03_230)] sm:text-[0.8rem]">Metro Mart Inc.</div>
              </div>
              <div className="mb-3 flex justify-end sm:mb-4">
                <div className="w-[140px] space-y-1 sm:w-[180px] sm:space-y-1.5">
                  <div className="flex justify-between text-[0.68rem] sm:text-[0.72rem]">
                    <span className="text-[oklch(0.55_0.02_230)]">Subtotal</span>
                    <span className="text-[oklch(0.35_0.03_230)]">$2,790.00</span>
                  </div>
                  <div className="flex justify-between text-[0.68rem] sm:text-[0.72rem]">
                    <span className="text-[oklch(0.55_0.02_230)]">Tax (8%)</span>
                    <span className="text-[oklch(0.35_0.03_230)]">$223.20</span>
                  </div>
                  <div className="flex justify-between border-t border-[oklch(0.90_0.01_230)] pt-1 text-[0.78rem] font-bold sm:pt-1.5 sm:text-[0.82rem]">
                    <span className="text-[oklch(0.35_0.03_230)]">Total</span>
                    <span className="text-[oklch(0.25_0.05_230)]">$3,013.20</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Action buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
              <div className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.7rem] font-semibold text-white sm:h-8 sm:px-3 sm:text-[0.75rem]" style={{ background: "oklch(0.35 0.10 230)" }}>
                <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Download PDF
              </div>
              <div className="flex h-7 items-center gap-1.5 rounded-lg border border-[oklch(0.88_0.02_230)] bg-white px-2.5 text-[0.7rem] font-semibold text-[oklch(0.40_0.05_230)] sm:h-8 sm:px-3 sm:text-[0.75rem]">
                <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Send Email
              </div>
            </div>
          </div>
        </div>
        <div className="order-2">
          <div className="mb-3 inline-flex items-center rounded-full border border-[oklch(0.88_0.04_230)] bg-[oklch(0.96_0.02_230)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.40_0.08_230)] sm:text-[0.75rem]">
            <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Invoice generation
          </div>
          <div className="mb-4 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-5 sm:text-[1.8rem] lg:text-[2.2rem]">Professional invoices<br className="hidden sm:block" /> in one click.</div>
          <p className="text-[0.9rem] leading-[1.7] text-[oklch(0.45_0.02_230)] sm:text-[1rem] lg:text-[1.05rem] lg:leading-[1.75]">Generate branded PDF invoices directly from fulfilled orders. Includes line items, taxes, payment terms, and your company branding.</p>
          <div className="mt-6 flex flex-wrap gap-2 sm:mt-8">
            {["Auto-populate", "Custom branding", "PDF export", "Bulk generation"].map(chip => (
              <div key={chip} className="flex items-center gap-2 rounded-full border border-[oklch(0.90_0.02_230)] bg-white px-3 py-1.5 text-[0.75rem] text-[oklch(0.40_0.03_230)] shadow-sm sm:px-3.5 sm:py-2 sm:text-[0.8rem]">
                <div className="size-1.5 rounded-full" style={{ background: "oklch(0.50 0.14 230)" }} />
                {chip}
              </div>
            ))}
          </div>
          <a href="#" className="mt-6 inline-flex items-center gap-2 text-[0.85rem] font-semibold text-[oklch(0.35_0.10_230)] transition-colors hover:text-[oklch(0.45_0.12_210)] sm:mt-8 sm:text-[0.9rem]">
            Explore invoicing 
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
      </div>
    </div>
  );
}

function EmailFeature() {
  return (
    <div className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
      background: `
        radial-gradient(ellipse 70% 50% at 80% 30%, oklch(0.92 0.05 165 / 0.15) 0%, transparent 50%),
        linear-gradient(180deg, white 0%, oklch(0.985 0.004 165) 50%, white 100%)
      `
    }}>
      <div className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: gridPattern }} />
      <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: crossPattern }} />
      <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="order-2 lg:order-1">
          <div className="mb-3 inline-flex items-center rounded-full border border-[oklch(0.85_0.05_165)] bg-[oklch(0.95_0.03_165)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.40_0.12_165)] sm:text-[0.75rem]">
            <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Email notifications
          </div>
          <div className="mb-4 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-5 sm:text-[1.8rem] lg:text-[2.2rem]">Keep everyone<br className="hidden sm:block" /> in the loop.</div>
          <p className="text-[0.9rem] leading-[1.7] text-[oklch(0.45_0.02_230)] sm:text-[1rem] lg:text-[1.05rem] lg:leading-[1.75]">Automated email notifications for every stage of the order lifecycle. From confirmations to reminders, stay informed without manual effort.</p>
          <div className="mt-6 flex flex-wrap gap-2 sm:mt-8">
            {["Order confirmations", "Invoice delivery", "Payment receipts", "Reminders"].map(chip => (
              <div key={chip} className="flex items-center gap-2 rounded-full border border-[oklch(0.88_0.04_165)] bg-white px-3 py-1.5 text-[0.75rem] text-[oklch(0.40_0.08_165)] shadow-sm sm:px-3.5 sm:py-2 sm:text-[0.8rem]">
                <div className="size-1.5 rounded-full" style={{ background: "oklch(0.55 0.12 165)" }} />
                {chip}
              </div>
            ))}
          </div>
          <a href="#" className="mt-6 inline-flex items-center gap-2 text-[0.85rem] font-semibold text-[oklch(0.45_0.12_165)] transition-colors hover:text-[oklch(0.55_0.14_165)] sm:mt-8 sm:text-[0.9rem]">
            Explore notifications 
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="order-1 overflow-hidden rounded-xl border border-[oklch(0.88_0.04_165)] bg-white shadow-[0_4px_6px_oklch(0_0_0/0.02),0_20px_50px_oklch(0.40_0.10_165/0.08)] sm:rounded-2xl lg:order-2">
          <div className="flex items-center justify-between border-b border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.003_230)] px-4 py-3 text-[0.72rem] font-semibold text-[oklch(0.45_0.02_230)] sm:px-5 sm:py-3.5 sm:text-[0.78rem]">
            <span>Notification Center</span>
            <span className="text-[0.7rem] font-medium text-[oklch(0.55_0.02_230)] sm:text-[0.75rem]">Last 24 hours</span>
          </div>
          <div className="bg-white p-3 sm:p-4">
            {[
              { title: "Invoice INV-0893 sent to Metro Mart", desc: "Delivered to accounting@metromart.com", time: "2 min ago", status: "Delivered", statusCls: "bg-[oklch(0.94_0.04_165)] text-[oklch(0.45_0.12_165)]", iconBg: "oklch(0.93 0.03 230)" },
              { title: "Payment received from Fresh Co.", desc: "$1,890.00 via ACH transfer", time: "1 hour ago", status: "Confirmed", statusCls: "bg-[oklch(0.94_0.04_165)] text-[oklch(0.45_0.12_165)]", iconBg: "oklch(0.94 0.04 165)" },
              { title: "Payment reminder sent to City Foods", desc: "INV-0887 overdue by 5 days", time: "3 hours ago", status: "Auto-sent", statusCls: "bg-[oklch(0.95_0.04_85)] text-[oklch(0.50_0.14_85)]", iconBg: "oklch(0.95 0.04 85)" },
            ].map((notif, i, arr) => (
              <div key={notif.title} className={`flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-[oklch(0.99_0.002_230)] sm:gap-3.5 sm:p-3.5 ${i < arr.length - 1 ? "mb-1 sm:mb-2" : ""}`}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-10 sm:rounded-xl" style={{ background: notif.iconBg }}>
                  <svg className="size-4 text-[oklch(0.45_0.10_230)] sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-start justify-between gap-2 sm:mb-1">
                    <span className="truncate text-[0.75rem] font-semibold text-[oklch(0.25_0.03_230)] sm:text-[0.8rem]">{notif.title}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.58rem] font-semibold sm:px-2 sm:text-[0.65rem] ${notif.statusCls}`}>{notif.status}</span>
                  </div>
                  <div className="truncate text-[0.7rem] text-[oklch(0.55_0.02_230)] sm:text-[0.75rem]">{notif.desc}</div>
                  <div className="mt-0.5 text-[0.65rem] text-[oklch(0.60_0.02_230)] sm:mt-1 sm:text-[0.7rem]">{notif.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
