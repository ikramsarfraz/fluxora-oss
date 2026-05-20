"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, ImagePlus, PaintBucket, Palette } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

import { TENANT } from "../_data/invoice";
import { FakeAppShell } from "./fake-app-shell";

// Scene 1: workspace branding setup. Logo dropped, palette swatch picked,
// preview card on the right updates live.

const PALETTE = [
  { hex: "#1F3A2E", label: "Forest" },
  { hex: "#8B3415", label: "Terracotta" },
  { hex: "#0F4D92", label: "Ocean" },
  { hex: "#6B4A0E", label: "Wheat" },
];

type Step = "blank" | "logo" | "palette" | "footer" | "done";

const STEPS: Step[] = ["blank", "logo", "palette", "footer", "done"];
const STEP_MS: Record<Step, number> = {
  blank: 700,
  logo: 1400,
  palette: 1700,
  footer: 1700,
  done: 2000,
};

export function BrandingScene() {
  const [step, setStep] = useState<Step>("blank");
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    for (let i = 0; i < STEPS.length - 1; i++) {
      acc += STEP_MS[STEPS[i]];
      const next = STEPS[i + 1];
      timers.push(setTimeout(() => setStep(next), acc));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const hasLogo = step !== "blank";
  const hasPalette =
    step === "palette" || step === "footer" || step === "done";
  const hasFooter = step === "footer" || step === "done";

  return (
    <motion.div
      key="branding-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell
        navHint="settings"
        crumbs={["Workspace settings", "Branding"]}
      >
        <div className="grid h-full grid-cols-[1fr_1fr] gap-0">
          {/* Form column */}
          <div className="overflow-y-auto p-6">
            <header>
              <h1 className="font-serif text-[22px] font-medium tracking-tight text-ink">
                Workspace branding
              </h1>
              <p className="mt-1 text-[12px] text-subtle">
                Your logo, your colors, your footer — applied to every invoice
                PDF.
              </p>
            </header>

            <div className="mt-6 space-y-4">
              {/* Logo dropzone */}
              <FormSlot
                icon={ImagePlus}
                label="Logo"
                hint=".png · .svg · up to 1 MB"
              >
                <motion.div
                  initial={false}
                  animate={hasLogo ? { opacity: 1 } : { opacity: 0.4 }}
                  className={cn(
                    "flex items-center gap-3 rounded-md border bg-card-warm px-3 py-2.5",
                    hasLogo
                      ? "border-success-border/70"
                      : "border-dashed border-border-default",
                  )}
                >
                  {hasLogo ? (
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                      className="flex size-10 items-center justify-center rounded-md bg-page"
                    >
                      <Logomark size={26} />
                    </motion.div>
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-md border border-dashed border-border-default text-subtle">
                      <ImagePlus className="size-4" strokeWidth={1.6} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-[12.5px] font-medium text-ink">
                      {hasLogo ? "pacific-wharf-logo.svg" : "Drop your logo"}
                    </div>
                    <div className="font-mono text-[10px] text-subtle">
                      {hasLogo ? "uploaded · 14 KB" : "or browse"}
                    </div>
                  </div>
                  {hasLogo ? (
                    <Check
                      className="size-4 text-success-fg"
                      strokeWidth={2.4}
                    />
                  ) : null}
                </motion.div>
              </FormSlot>

              {/* Palette */}
              <FormSlot icon={Palette} label="Accent color">
                <div className="flex items-center gap-2">
                  {PALETTE.map((c) => (
                    <motion.div
                      key={c.hex}
                      animate={
                        hasPalette && c.hex === TENANT.primaryHex
                          ? { scale: [1, 1.15, 1] }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.4 }}
                      className={cn(
                        "relative flex size-8 items-center justify-center rounded-md border",
                        hasPalette && c.hex === TENANT.primaryHex
                          ? "border-ink ring-2 ring-ink/30"
                          : "border-border-default",
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {hasPalette && c.hex === TENANT.primaryHex ? (
                        <Check
                          className="size-3.5 text-card-warm"
                          strokeWidth={2.6}
                        />
                      ) : null}
                    </motion.div>
                  ))}
                  <span className="ml-2 font-mono text-[10.5px] text-subtle">
                    {hasPalette ? TENANT.primaryHex : "—"}
                  </span>
                </div>
              </FormSlot>

              {/* Footer text */}
              <FormSlot icon={PaintBucket} label="Footer">
                <motion.div
                  animate={hasFooter ? { opacity: 1 } : { opacity: 0.4 }}
                  className="rounded-md border border-border-default bg-card-warm px-3 py-2 text-[12px]"
                >
                  {hasFooter
                    ? `${TENANT.address1} · ${TENANT.address2} · ${TENANT.email}`
                    : "Enter footer text…"}
                </motion.div>
              </FormSlot>
            </div>

            {step === "done" ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-success-bg/50 px-3 py-2 text-[11.5px] font-medium text-success-fg"
              >
                <Check className="size-3.5" strokeWidth={2.4} />
                Branding saved · applies to every PDF from now on
              </motion.div>
            ) : null}
          </div>

          {/* Live preview */}
          <aside className="flex flex-col bg-card-warm/30 p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Live preview
            </div>
            <motion.div
              animate={hasFooter ? { y: -2 } : { y: 0 }}
              className="mt-3 flex flex-1 items-start justify-center"
            >
              <div className="aspect-[0.78] w-[300px] overflow-hidden rounded-md border border-border-default bg-white shadow-md">
                <div className="flex h-full flex-col p-5 text-[8px] text-[#1A1A14]">
                  <div className="flex items-start justify-between">
                    <motion.div
                      initial={false}
                      animate={hasLogo ? { opacity: 1 } : { opacity: 0.15 }}
                      className="flex items-center gap-1.5"
                    >
                      <Logomark size={20} />
                      <span
                        className="font-serif text-[12px] font-medium leading-none"
                        style={{ color: hasPalette ? TENANT.primaryHex : "#999" }}
                      >
                        {TENANT.name}
                      </span>
                    </motion.div>
                    <div className="text-right">
                      <div className="font-mono text-[7px] uppercase text-[#6B6451]">
                        Invoice
                      </div>
                      <div className="font-mono text-[8px]">INV-2847</div>
                    </div>
                  </div>
                  <div className="mt-2 h-px bg-[#DDD3B8]" />
                  <div className="mt-2 space-y-1.5">
                    <div className="h-1 w-3/4 rounded bg-[#EFECD9]" />
                    <div className="h-1 w-2/3 rounded bg-[#EFECD9]" />
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="h-2 rounded bg-[#EFECD9]" />
                    <div className="h-2 rounded bg-[#EFECD9]" />
                    <div className="h-2 rounded bg-[#EFECD9]" />
                  </div>
                  <div className="mt-auto">
                    <motion.div
                      initial={false}
                      animate={hasPalette ? { opacity: 1 } : { opacity: 0.15 }}
                      className="font-mono text-[7px] font-medium"
                      style={{ color: hasPalette ? TENANT.primaryHex : "#999" }}
                    >
                      Total · $1,128.00
                    </motion.div>
                    <motion.div
                      initial={false}
                      animate={hasFooter ? { opacity: 1 } : { opacity: 0.15 }}
                      className="mt-2 border-t border-[#DDD3B8] pt-1 font-mono text-[6.5px] text-[#6B6451]"
                    >
                      {TENANT.address1} · {TENANT.email}
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function FormSlot({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          <Icon className="size-3" strokeWidth={2} />
          {label}
        </div>
        {hint ? (
          <span className="font-mono text-[10px] text-subtle">{hint}</span>
        ) : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
