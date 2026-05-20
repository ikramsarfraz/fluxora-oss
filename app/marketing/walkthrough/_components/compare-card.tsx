"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  Sparkles,
  Timer,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Transition card shown between scenes. Manual ("the old way") on the left,
// Fluxora on the right. Each side has a single time stat + 2-3 bullets.
// Sized to match the surrounding scene frames so swapping in/out is a
// clean A → B (no layout jump).

export type ComparePayload = {
  step: string;
  manual: {
    time: string;
    bullets: string[];
  };
  fluxora: {
    time: string;
    bullets: string[];
  };
};

export function CompareCard({ compare }: { compare: ComparePayload }) {
  return (
    <motion.div
      key={compare.step}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col items-center justify-center bg-page p-10"
    >
      {/* Top label */}
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-subtle">
        {compare.step}
      </div>

      <div className="mt-6 grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-6">
        {/* Manual */}
        <ComparePane
          tone="danger"
          label="The old way"
          icon={FileSpreadsheet}
          time={compare.manual.time}
          bullets={compare.manual.bullets}
          delay={0.1}
        />

        {/* Arrow */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-forest-mid text-card-warm shadow-sm">
            <ArrowRight className="size-4" strokeWidth={2.2} />
          </div>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
            with Fluxora
          </span>
        </motion.div>

        {/* Fluxora */}
        <ComparePane
          tone="success"
          label="Fluxora"
          icon={Sparkles}
          time={compare.fluxora.time}
          bullets={compare.fluxora.bullets}
          delay={0.45}
        />
      </div>
    </motion.div>
  );
}

function ComparePane({
  tone,
  label,
  icon: Icon,
  time,
  bullets,
  delay,
}: {
  tone: "danger" | "success";
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  time: string;
  bullets: string[];
  delay: number;
}) {
  const isFluxora = tone === "success";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col rounded-2xl border-2 bg-card-warm p-5",
        isFluxora
          ? "border-success-border/70 shadow-[0_22px_50px_-25px_rgba(74,107,47,0.4)]"
          : "border-danger-border/40 opacity-90",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]",
          isFluxora ? "text-success-fg" : "text-danger-fg",
        )}
      >
        <Icon className="size-3" strokeWidth={2.2} />
        {label}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <Timer
          className={cn(
            "size-4",
            isFluxora ? "text-success-fg" : "text-danger-fg",
          )}
          strokeWidth={1.6}
        />
        <span
          className={cn(
            "font-serif text-[34px] font-medium leading-none tabular-nums",
            isFluxora ? "text-success-fg" : "text-danger-fg",
          )}
        >
          {time}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5 text-[12.5px] leading-[1.5] text-ink-warm">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5">
            {isFluxora ? (
              <Check
                className="mt-0.5 size-3 shrink-0 text-success-fg"
                strokeWidth={2.6}
              />
            ) : (
              <X
                className="mt-0.5 size-3 shrink-0 text-danger-fg"
                strokeWidth={2.6}
              />
            )}
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
