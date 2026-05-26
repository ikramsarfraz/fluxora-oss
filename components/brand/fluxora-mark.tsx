import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
};

export function FluxoraMark({ size = 28, className }: Props) {
  return (
    <span
      aria-label="Fluxora"
      className={cn(
        "relative inline-grid place-items-center rounded-md bg-forest font-sans font-semibold text-card-warm leading-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.54),
      }}
    >
      F
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bg-gold"
        style={{
          left: `${(7 / 28) * 100}%`,
          right: `${(7 / 28) * 100}%`,
          bottom: `${(5 / 28) * 100}%`,
          height: 1.5,
        }}
      />
    </span>
  );
}

export function FluxoraWordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink">
      <FluxoraMark size={size} />
      <span className="relative">
        Fluxora
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bg-gold"
          style={{ left: 0, right: "65%", bottom: -3, height: 1.5 }}
        />
      </span>
    </span>
  );
}
