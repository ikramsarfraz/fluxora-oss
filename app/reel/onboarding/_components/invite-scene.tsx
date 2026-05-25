"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Mail, Plus, Users } from "lucide-react";

import { cn } from "@/lib/utils";

import { WIZARD_STEPS, WizardShell } from "./wizard-shell";

type Invite = {
  email: string;
  role: "Admin" | "Member" | "Warehouse";
};

const TARGET_INVITES: Invite[] = [
  { email: "mateo@pacificwharf.com", role: "Admin" },
  { email: "lily@pacificwharf.com", role: "Member" },
  { email: "diego@pacificwharf.com", role: "Warehouse" },
];

export function InviteScene() {
  const [added, setAdded] = useState<Invite[]>([]);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    TARGET_INVITES.forEach((inv, idx) => {
      timers.push(
        setTimeout(
          () => setAdded((prev) => [...prev, inv]),
          800 + idx * 1700,
        ),
      );
    });
    timers.push(
      setTimeout(() => setSent(true), 800 + TARGET_INVITES.length * 1700 + 600),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="invite-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <WizardShell steps={WIZARD_STEPS} currentIdx={1}>
        <div className="w-full max-w-[560px]">
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-ink">
            Bring your team in.
          </h1>
          <p className="mt-2 text-[13px] text-subtle">
            We&apos;ll send each person an invite with their role pre-assigned.
          </p>

          <div className="mt-6">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              <Users className="size-3" strokeWidth={2} />
              Invited
              <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-ink-warm">
                {added.length}
              </span>
            </div>

            <ul className="mt-2 space-y-2">
              <AnimatePresence>
                {added.map((inv) => (
                  <motion.li
                    key={inv.email}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 22,
                    }}
                    className="flex items-center gap-3 rounded-md border border-border-default bg-card-warm px-3 py-2.5"
                  >
                    <div className="flex size-7 items-center justify-center rounded-full bg-info-bg text-info-fg">
                      <Mail className="size-3.5" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[12.5px] font-medium text-ink">
                        {inv.email}
                      </div>
                    </div>
                    <RolePill role={inv.role} />
                  </motion.li>
                ))}
              </AnimatePresence>
              {/* Add-another row */}
              {!sent ? (
                <li className="flex items-center gap-2 rounded-md border border-dashed border-border-default bg-card-warm/40 px-3 py-2.5 text-[12px] text-subtle">
                  <Plus className="size-3.5" strokeWidth={2} />
                  Type an email to invite…
                </li>
              ) : null}
            </ul>
          </div>

          <AnimatePresence>
            {sent ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-center gap-2 rounded-md border border-success-border/60 bg-success-bg/40 px-3 py-2 text-[11.5px] font-medium text-success-fg"
              >
                <Check className="size-3.5" strokeWidth={2.4} />3 invites sent ·
                each lands in inbox with a one-click sign-in link
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              disabled
              className="rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px] text-ink-warm"
            >
              Skip
            </button>
            <button
              disabled
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium",
                sent
                  ? "bg-success-fg text-card-warm"
                  : "bg-info-fg text-card-warm",
              )}
            >
              {sent ? "Continue" : "Send invites"}
            </button>
          </div>
        </div>
      </WizardShell>
    </motion.div>
  );
}

function RolePill({ role }: { role: Invite["role"] }) {
  const tone =
    role === "Admin"
      ? "bg-forest-tint/60 text-forest-mid"
      : role === "Warehouse"
        ? "bg-warning-bg/70 text-warning-fg"
        : "bg-info-bg/60 text-info-fg";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
        tone,
      )}
    >
      {role}
    </span>
  );
}
