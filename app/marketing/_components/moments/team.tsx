"use client";

import { motion } from "motion/react";
import {
  Boxes,
  Crown,
  FileText,
  LayoutDashboard,
  Lock,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MomentFrame } from "./moment-frame";

// Roles moment: three teammate cards side-by-side, each showing their
// own sidebar visibility — same workspace, different eyes.
type Pane = {
  name: string;
  avatar: string;
  role: "Owner" | "Member" | "Warehouse";
  visible: string[];
};

const ALL = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Customers", icon: Users },
  { label: "Inventory", icon: Boxes },
  { label: "Orders", icon: FileText },
  { label: "Payments", icon: Wallet },
];

const PANES: Pane[] = [
  {
    name: "Sarah",
    avatar: "SC",
    role: "Owner",
    visible: ["Dashboard", "Customers", "Inventory", "Orders", "Payments"],
  },
  {
    name: "Mateo",
    avatar: "MR",
    role: "Member",
    visible: ["Dashboard", "Customers", "Orders"],
  },
  {
    name: "Diego",
    avatar: "DP",
    role: "Warehouse",
    visible: ["Inventory", "Orders"],
  },
];

const ROLE_TONE: Record<Pane["role"], string> = {
  Owner: "bg-forest-tint text-forest-mid",
  Member: "bg-info-bg text-info-fg",
  Warehouse: "bg-warning-bg text-warning-fg",
};

export function RolesMoment() {
  return (
    <MomentFrame label="Roles · per-person view" tone="forest">
      <div className="p-6">
        <h3 className="font-serif text-[20px] font-medium tracking-tight text-ink">
          Same workspace. Three pairs of eyes.
        </h3>
        <p className="mt-1 text-[12.5px] text-subtle">
          The sidebar morphs per role. Server-enforced.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {PANES.map((p, idx) => (
            <Card key={p.name} pane={p} delay={0.2 + idx * 0.12} />
          ))}
        </div>
      </div>
    </MomentFrame>
  );
}

function Card({ pane, delay }: { pane: Pane; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border-default bg-card-warm p-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-forest-tint font-mono text-[10px] font-bold text-forest-mid">
          {pane.avatar}
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-medium text-ink">{pane.name}</div>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
              ROLE_TONE[pane.role],
            )}
          >
            {pane.role === "Owner" ? (
              <Crown className="size-2" strokeWidth={2.4} />
            ) : null}
            {pane.role}
          </span>
        </div>
      </div>

      <div className="mt-3 font-mono text-[8.5px] uppercase tracking-[0.14em] text-subtle">
        Sidebar
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {ALL.map((nav, i) => {
          const visible = pane.visible.includes(nav.label);
          const Icon = nav.icon;
          return (
            <motion.li
              key={nav.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: visible ? 1 : 0.35, x: 0 }}
              transition={{ delay: delay + 0.15 + i * 0.03 }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10.5px]",
                visible ? "bg-card-warm text-ink-warm" : "text-subtle",
              )}
            >
              {visible ? (
                <Icon className="size-2.5" strokeWidth={1.8} />
              ) : (
                <Lock className="size-2.5" strokeWidth={1.8} />
              )}
              <span className={cn(!visible && "line-through")}>
                {nav.label}
              </span>
            </motion.li>
          );
        })}
      </ul>

      <div className="mt-2 rounded bg-surface/40 px-2 py-1 text-center font-mono text-[8.5px] text-subtle">
        {pane.visible.length} / {ALL.length} modules
      </div>
    </motion.div>
  );
}
