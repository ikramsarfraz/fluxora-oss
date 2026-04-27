export function LogoStrip() {
  return (
    <div id="customers" className="relative border-y border-[oklch(0.92_0.01_230)] bg-[oklch(0.99_0.002_230)] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 sm:flex-row sm:gap-0">
        <div className="shrink-0 text-center text-[0.78rem] font-medium leading-snug text-[oklch(0.50_0.02_230)] sm:border-r sm:border-[oklch(0.90_0.01_230)] sm:pr-8 sm:text-left sm:text-[0.82rem] lg:pr-10">
          Trusted by leading<br className="hidden sm:block" /><span className="sm:hidden"> </span>distribution teams
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-start sm:gap-x-8 sm:pl-8 lg:gap-x-12 lg:pl-10">
          {["Metro Foods", "Harbor Wholesale", "FreshLine Co.", "Apex Distribution", "City Supply"].map(name => (
            <div key={name} className="text-[0.85rem] font-semibold tracking-tight text-[oklch(0.60_0.02_230)] sm:text-[0.9rem] lg:text-[0.95rem]">{name}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
