"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Building2, Check, Globe } from "lucide-react";

import { cn } from "@/lib/utils";

import { WIZARD_STEPS, WizardShell } from "./wizard-shell";

const TARGET_NAME = "Pacific Wharf Provisions";
const SLUG_TARGET = "pacificwharf";

export function SubdomainScene() {
  const [typed, setTyped] = useState("");
  const [slug, setSlug] = useState("");
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= TARGET_NAME.length; i++) {
      timers.push(
        setTimeout(() => {
          setTyped(TARGET_NAME.slice(0, i));
          // Slug derives from name with a slight delay so it animates
          const newSlug = TARGET_NAME.slice(0, i)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, SLUG_TARGET.length);
          setSlug(newSlug);
        }, 400 + i * 40),
      );
    }
    // Availability check spinner → ✓
    timers.push(
      setTimeout(
        () => setAvailable(true),
        400 + TARGET_NAME.length * 40 + 800,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="subdomain-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <WizardShell steps={WIZARD_STEPS} currentIdx={0}>
        <div className="w-full max-w-[520px]">
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-ink">
            What&apos;s the name of your business?
          </h1>
          <p className="mt-2 text-[13px] text-subtle">
            It&apos;ll show up at the top of every doc you send.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Business name" icon={Building2}>
              <div className="flex items-center gap-1.5 text-[15px] text-ink">
                <span>{typed}</span>
                {!available ? <BlinkingCaret /> : null}
              </div>
            </Field>

            <Field label="Workspace URL" icon={Globe}>
              <div className="flex items-center gap-1 text-[14px]">
                <span className="font-mono text-ink">{slug}</span>
                <span className="font-mono text-subtle">.fluxora.app</span>
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={
                    available ? { opacity: 1, scale: 1 } : { opacity: 0 }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 18,
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-medium text-success-fg"
                >
                  <Check className="size-2.5" strokeWidth={2.6} />
                  available
                </motion.span>
              </div>
            </Field>
          </div>

          {available ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mt-6 flex items-center justify-end gap-2"
            >
              <button
                disabled
                className="rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px] text-ink-warm"
              >
                Back
              </button>
              <button
                disabled
                className="inline-flex items-center gap-1.5 rounded-md bg-info-fg px-3 py-1.5 text-[12px] font-medium text-card-warm"
              >
                Continue
                <span className="font-mono text-[10px]">→</span>
              </button>
            </motion.div>
          ) : null}
        </div>
      </WizardShell>
    </motion.div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        <Icon className="size-3" strokeWidth={2} />
        {label}
      </div>
      <div className={cn("mt-1 rounded-md border border-info-fg/30 bg-card-warm px-3 py-2.5 ring-2 ring-info-fg/10")}>
        {children}
      </div>
    </div>
  );
}

function BlinkingCaret() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-[18px] w-[2px] bg-ink"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
    />
  );
}
