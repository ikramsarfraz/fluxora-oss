"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Boxes,
  Check,
  FileText,
  Landmark,
  Package,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { WIZARD_STEPS, WizardShell } from "./wizard-shell";

type Task = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  detail: string;
};

const TASKS: Task[] = [
  { icon: Users, title: "Add your first customer", detail: "Import a list or add one manually." },
  { icon: Package, title: "Add a product", detail: "Or load your catalog from Excel." },
  { icon: Boxes, title: "Receive your first lot", detail: "Stock the shelf, FIFO will do the rest." },
  { icon: Landmark, title: "Connect a bank", detail: "Plaid pulls transactions on a schedule." },
  { icon: FileText, title: "Create your first invoice", detail: "Branded PDF, sent in one click." },
];

const COMPLETE_ORDER = [0, 1, 2, 3, 4];

export function ChecklistScene() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    COMPLETE_ORDER.forEach((idx, i) => {
      timers.push(
        setTimeout(() => {
          setCompleted((prev) => new Set(prev).add(idx));
        }, 900 + i * 900),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const pct = (completed.size / TASKS.length) * 100;

  return (
    <motion.div
      key="checklist-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <WizardShell steps={WIZARD_STEPS} currentIdx={2}>
        <div className="w-full max-w-[560px]">
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-ink">
            Five things to set you up.
          </h1>
          <p className="mt-2 text-[13px] text-subtle">
            Tick them off in any order. Done in a few clicks each.
          </p>

          <div className="mt-6 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Progress
            </span>
            <span className="font-mono text-[11px] text-ink-warm">
              {completed.size} / {TASKS.length}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
            <motion.div
              className="h-full bg-info-fg"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <ul className="mt-5 space-y-2.5">
            {TASKS.map((task, idx) => {
              const done = completed.has(idx);
              const Icon = task.icon;
              return (
                <motion.li
                  key={task.title}
                  animate={
                    done
                      ? {
                          backgroundColor: [
                            "rgba(184, 201, 158, 0)",
                            "rgba(184, 201, 158, 0.35)",
                            "rgba(184, 201, 158, 0.1)",
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 0.7 }}
                  className={cn(
                    "flex items-center gap-3 rounded-md border bg-card-warm px-3 py-2.5",
                    done
                      ? "border-success-border/70"
                      : "border-border-default",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      done
                        ? "bg-success-bg text-success-fg"
                        : "bg-surface text-subtle",
                    )}
                  >
                    {done ? (
                      <Check className="size-4" strokeWidth={2.6} />
                    ) : (
                      <Icon className="size-4" strokeWidth={1.8} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "text-[12.5px] font-medium",
                        done
                          ? "text-ink-warm line-through decoration-success-fg/40"
                          : "text-ink",
                      )}
                    >
                      {task.title}
                    </div>
                    <div className="font-mono text-[10.5px] text-subtle">
                      {task.detail}
                    </div>
                  </div>
                  {done ? (
                    <span className="font-mono text-[10px] text-success-fg">
                      done
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-subtle">
                      to do
                    </span>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </div>
      </WizardShell>
    </motion.div>
  );
}
