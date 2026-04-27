import { dotPattern } from "./styles";

export function Stats() {
  return (
    <div className="relative overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20" style={{ 
      background: `
        radial-gradient(ellipse 80% 60% at 20% 100%, oklch(0.92 0.04 195 / 0.3) 0%, transparent 50%),
        radial-gradient(ellipse 60% 50% at 80% 80%, oklch(0.93 0.03 230 / 0.25) 0%, transparent 50%),
        oklch(0.985 0.003 230)
      `
    }}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: dotPattern }} />
      
      <div className="relative mx-auto grid max-w-[1120px] grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8">
        {[
          { val: "100%", label: "Tenant isolated", desc: "Complete data separation" },
          { val: "12+", label: "Core ERP modules", desc: "End-to-end operations" },
          { val: "<2s", label: "Average page load", desc: "Fast, responsive UI" },
          { val: "99.9%", label: "Uptime SLA", desc: "Enterprise reliability" },
        ].map((s, i) => (
          <div key={s.label} className={`relative rounded-xl border border-[oklch(0.90_0.02_230)] bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:rounded-2xl sm:p-5 lg:p-6 ${i === 0 ? "border-[oklch(0.80_0.06_195)]" : ""}`}>
            {i === 0 && <div className="absolute -inset-px -z-10 rounded-xl sm:rounded-2xl" style={{ background: "linear-gradient(135deg, oklch(0.90 0.06 195 / 0.3), oklch(0.92 0.04 230 / 0.2))" }} />}
            <div className="mb-1.5 text-[1.8rem] font-extrabold tracking-[-0.04em] text-[oklch(0.25_0.05_230)] sm:mb-2 sm:text-[2.2rem] lg:text-[2.8rem]">{s.val}</div>
            <div className="text-[0.8rem] font-semibold text-[oklch(0.30_0.04_230)] sm:text-[0.85rem] lg:text-[0.9rem]">{s.label}</div>
            <div className="mt-0.5 text-[0.72rem] text-[oklch(0.55_0.02_230)] sm:mt-1 sm:text-[0.75rem] lg:text-[0.78rem]">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
