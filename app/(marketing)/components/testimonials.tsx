import { dotPattern, diagonalLinesPattern } from "./styles";

export function Testimonials() {
  return (
    <div className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
      background: `
        radial-gradient(ellipse 80% 60% at 20% 80%, oklch(0.92 0.05 195 / 0.15) 0%, transparent 50%),
        linear-gradient(180deg, white 0%, oklch(0.985 0.004 230) 50%, white 100%)
      `
    }}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: dotPattern }} />
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: diagonalLinesPattern }} />
      <div className="relative mx-auto max-w-[1120px]">
        <div className="mb-10 text-center sm:mb-14">
          <div className="mb-3 inline-flex items-center rounded-full border border-[oklch(0.88_0.04_230)] bg-white px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.40_0.08_230)] sm:text-[0.75rem]">
            <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Testimonials
          </div>
          <div className="mb-3 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-4 sm:text-[1.8rem] lg:text-[2.2rem]">Loved by distribution teams.</div>
          <p className="mx-auto max-w-[520px] text-[0.9rem] leading-[1.7] text-[oklch(0.50_0.02_230)] sm:text-[1rem]">See what our customers are saying about running their operations on Fluxora.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {[
            { quote: "Fluxora replaced three separate systems for us. Orders, inventory, and invoicing finally live in one place.", name: "Sarah Chen", role: "Operations Manager", company: "Metro Foods", rating: 5 },
            { quote: "The lot tracking feature alone saved us during our last audit. We can trace every unit back to its source.", name: "Marcus Williams", role: "Warehouse Lead", company: "Harbor Wholesale", rating: 5 },
            { quote: "Our team was up and running in a day. The interface is intuitive and the support team is incredibly responsive.", name: "Elena Rodriguez", role: "CEO", company: "FreshLine Co.", rating: 5 },
          ].map(t => (
            <div key={t.name} className="flex flex-col rounded-xl border border-[oklch(0.90_0.02_230)] bg-white p-5 shadow-sm sm:rounded-2xl sm:p-7">
              <div className="mb-3 flex gap-0.5 sm:mb-4 sm:gap-1">
                {[...Array(t.rating)].map((_, i) => (
                  <svg key={i} className="size-3.5 text-[oklch(0.70_0.16_85)] sm:size-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <p className="mb-5 flex-1 text-[0.88rem] leading-relaxed text-[oklch(0.35_0.02_230)] sm:mb-6 sm:text-[0.95rem]">{`"${t.quote}"`}</p>
              <div className="flex items-center gap-3 border-t border-[oklch(0.94_0.01_230)] pt-4 sm:pt-5">
                <div className="flex size-9 items-center justify-center rounded-full text-[0.75rem] font-bold text-white sm:size-10 sm:text-[0.8rem]" style={{ background: "linear-gradient(135deg, oklch(0.50 0.14 230), oklch(0.55 0.15 195))" }}>
                  {t.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <div className="text-[0.8rem] font-semibold text-[oklch(0.25_0.03_230)] sm:text-[0.85rem]">{t.name}</div>
                  <div className="text-[0.72rem] text-[oklch(0.55_0.02_230)] sm:text-[0.78rem]">{t.role} · {t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
