"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Boxes,
  ChevronRight,
  Check,
  Crown,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Package,
  Receipt,
  ShieldX,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// All three Roles & Permissions scenes in one file.

// =========================================================================
// Scene 1 — Permission matrix
// =========================================================================
const ROLES = ["Owner", "Admin", "Member", "Warehouse"] as const;
type Role = (typeof ROLES)[number];

type PermRow = {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Per role, the access level. "full" / "read" / "none" */
  access: Record<Role, "full" | "read" | "none">;
};

const PERMISSIONS: PermRow[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    access: { Owner: "full", Admin: "full", Member: "read", Warehouse: "none" },
  },
  {
    label: "Customers",
    icon: Users,
    access: { Owner: "full", Admin: "full", Member: "read", Warehouse: "none" },
  },
  {
    label: "Orders",
    icon: FileText,
    access: { Owner: "full", Admin: "full", Member: "full", Warehouse: "read" },
  },
  {
    label: "Invoices",
    icon: Receipt,
    access: { Owner: "full", Admin: "full", Member: "read", Warehouse: "none" },
  },
  {
    label: "Inventory",
    icon: Boxes,
    access: { Owner: "full", Admin: "full", Member: "read", Warehouse: "full" },
  },
  {
    label: "Payments",
    icon: Wallet,
    access: { Owner: "full", Admin: "full", Member: "none", Warehouse: "none" },
  },
];

const ACCESS_LABEL: Record<"full" | "read" | "none", string> = {
  full: "Full",
  read: "Read",
  none: "—",
};

const ACCESS_TONE: Record<"full" | "read" | "none", string> = {
  full: "bg-success-bg/70 text-success-fg",
  read: "bg-info-bg/60 text-info-fg",
  none: "bg-surface text-subtle",
};

export function MatrixScene() {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= PERMISSIONS.length; i++) {
      timers.push(setTimeout(() => setReveal(i), 600 + i * 400));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="matrix-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col bg-page"
    >
      <header className="border-b border-border-default bg-card-warm/60 px-6 py-4">
        <div className="flex items-center gap-2">
          <Logomark size={22} />
          <span className="font-serif text-[15px] font-medium text-ink">
            Fluxora
          </span>
          <ChevronRight className="size-3 text-subtle" strokeWidth={2} />
          <span className="text-[12.5px] text-subtle">Workspace settings</span>
          <ChevronRight className="size-3 text-subtle" strokeWidth={2} />
          <span className="text-[12.5px] font-medium text-ink">Roles</span>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
          Permission matrix
        </h1>
        <p className="mt-1 text-[12.5px] text-subtle">
          Who can see what, who can change what. Server-enforced row-by-row.
        </p>

        <div className="mt-5 overflow-hidden rounded-xl border border-border-default bg-card-warm">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Module</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-4 py-3 text-center font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {r === "Owner" ? (
                        <Crown className="size-3 text-forest-mid" strokeWidth={2} />
                      ) : null}
                      {r}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm, idx) => {
                const visible = idx < reveal;
                return (
                  <motion.tr
                    key={perm.label}
                    animate={
                      visible
                        ? {
                            opacity: 1,
                            y: 0,
                            backgroundColor:
                              idx === reveal - 1
                                ? [
                                    "rgba(184, 201, 158, 0)",
                                    "rgba(184, 201, 158, 0.35)",
                                    "rgba(184, 201, 158, 0)",
                                  ]
                                : "transparent",
                          }
                        : { opacity: 0, y: 8 }
                    }
                    transition={{ duration: 0.7 }}
                    className="border-t border-border-default"
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                        <perm.icon
                          className="size-3.5 text-subtle"
                          strokeWidth={1.8}
                        />
                        {perm.label}
                      </span>
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-4 py-2.5 text-center">
                        {visible ? (
                          <AccessPill access={perm.access[r]} />
                        ) : (
                          <span className="font-mono text-[10px] text-subtle">
                            …
                          </span>
                        )}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {reveal >= PERMISSIONS.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-success-border/60 bg-success-bg/40 px-3 py-2 text-[11.5px] font-medium text-success-fg"
          >
            <Check className="size-3.5" strokeWidth={2.4} />
            Saved · enforced from the next request
          </motion.div>
        ) : null}
      </main>
    </motion.div>
  );
}

function AccessPill({ access }: { access: "full" | "read" | "none" }) {
  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium",
        ACCESS_TONE[access],
      )}
    >
      {access === "full" ? (
        <Check className="size-2.5" strokeWidth={2.6} />
      ) : access === "read" ? (
        <Eye className="size-2.5" strokeWidth={2.4} />
      ) : (
        <EyeOff className="size-2.5" strokeWidth={2.4} />
      )}
      {ACCESS_LABEL[access]}
    </motion.span>
  );
}

// =========================================================================
// Scene 2 — Three perspectives
// =========================================================================
type Perspective = {
  role: Role;
  name: string;
  avatar: string;
  /** Modules visible in the sidebar for this perspective. */
  visible: string[];
};

const PERSPECTIVES: Perspective[] = [
  {
    role: "Owner",
    name: "Sarah Chen",
    avatar: "SC",
    visible: [
      "Dashboard",
      "Customers",
      "Suppliers",
      "Inventory",
      "Orders",
      "Invoices",
      "Payments",
      "Reports",
    ],
  },
  {
    role: "Member",
    name: "Mateo Rivera",
    avatar: "MR",
    visible: ["Dashboard", "Customers", "Orders", "Invoices"],
  },
  {
    role: "Warehouse",
    name: "Diego Patel",
    avatar: "DP",
    visible: ["Orders", "Inventory"],
  },
];

const ALL_NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Customers", icon: Users },
  { label: "Suppliers", icon: Truck },
  { label: "Inventory", icon: Boxes },
  { label: "Orders", icon: FileText },
  { label: "Invoices", icon: Receipt },
  { label: "Payments", icon: Wallet },
  { label: "Products", icon: Package },
];

export function PerspectiveScene() {
  return (
    <motion.div
      key="perspective-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col bg-page"
    >
      <header className="border-b border-border-default px-6 py-5">
        <h1 className="font-serif text-[22px] font-medium tracking-tight text-ink">
          Same workspace. Three pairs of eyes.
        </h1>
        <p className="mt-0.5 text-[12px] text-subtle">
          Each person sees only what their role permits.
        </p>
      </header>
      <div className="grid flex-1 grid-cols-3 gap-0 overflow-hidden">
        {PERSPECTIVES.map((p, idx) => (
          <PerspectiveCard key={p.role} perspective={p} delay={0.25 + idx * 0.15} />
        ))}
      </div>
    </motion.div>
  );
}

function PerspectiveCard({
  perspective,
  delay,
}: {
  perspective: Perspective;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col border-r border-border-default last:border-r-0 bg-card-warm/30"
    >
      {/* Card header */}
      <div className="border-b border-border-default bg-card-warm px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-forest-tint font-mono text-[12px] font-bold text-forest-mid">
            {perspective.avatar}
          </div>
          <div>
            <div className="text-[12.5px] font-medium text-ink">
              {perspective.name}
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em]",
                perspective.role === "Owner"
                  ? "bg-forest-tint text-forest-mid"
                  : perspective.role === "Member"
                    ? "bg-info-bg text-info-fg"
                    : "bg-warning-bg text-warning-fg",
              )}
            >
              {perspective.role === "Owner" ? (
                <Crown className="size-2.5" strokeWidth={2.4} />
              ) : null}
              {perspective.role}
            </span>
          </div>
        </div>
      </div>

      {/* Mini sidebar showing what they see */}
      <div className="flex-1 p-4">
        <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
          Sidebar
        </div>
        <ul className="space-y-1">
          {ALL_NAV.map((nav, navIdx) => {
            const visible = perspective.visible.includes(nav.label);
            const Icon = nav.icon;
            return (
              <motion.li
                key={nav.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{
                  opacity: visible ? 1 : 0.25,
                  x: 0,
                }}
                transition={{ delay: delay + 0.2 + navIdx * 0.03 }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px]",
                  visible
                    ? "bg-card-warm text-ink-warm"
                    : "text-subtle",
                )}
              >
                {visible ? (
                  <Icon className="size-3" strokeWidth={1.8} />
                ) : (
                  <Lock className="size-3" strokeWidth={1.8} />
                )}
                <span className={cn(!visible && "line-through")}>
                  {nav.label}
                </span>
              </motion.li>
            );
          })}
        </ul>

        {/* Footer summary */}
        <div className="mt-3 rounded-md bg-card-warm/60 px-3 py-2 font-mono text-[10px] text-subtle">
          {perspective.visible.length} of {ALL_NAV.length} modules
        </div>
      </div>
    </motion.div>
  );
}

// =========================================================================
// Scene 3 — Audit log
// =========================================================================
type AuditEvent = {
  who: string;
  whoRole: Role;
  action: string;
  resource: string;
  result: "allowed" | "denied";
  time: string;
};

const AUDIT_EVENTS: AuditEvent[] = [
  { who: "Sarah Chen", whoRole: "Owner", action: "viewed", resource: "P&L · April", result: "allowed", time: "8:42:11 AM" },
  { who: "Diego Patel", whoRole: "Warehouse", action: "marked picked", resource: "SO-2845", result: "allowed", time: "8:41:38 AM" },
  { who: "Diego Patel", whoRole: "Warehouse", action: "viewed", resource: "Customer balances", result: "denied", time: "8:40:52 AM" },
  { who: "Mateo Rivera", whoRole: "Member", action: "edited", resource: "Customer · Anchor Tavern", result: "allowed", time: "8:39:14 AM" },
  { who: "Diego Patel", whoRole: "Warehouse", action: "exported", resource: "Customer list", result: "denied", time: "8:35:47 AM" },
  { who: "Mateo Rivera", whoRole: "Member", action: "deleted", resource: "Invoice INV-2818", result: "denied", time: "8:31:09 AM" },
];

export function AuditScene() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= AUDIT_EVENTS.length; i++) {
      timers.push(setTimeout(() => setShown(i), 400 + i * 700));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="audit-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col bg-page"
    >
      <header className="flex items-center justify-between border-b border-border-default bg-card-warm/60 px-6 py-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            <LifeBuoy className="size-3" strokeWidth={2} />
            Audit log · today
          </div>
          <h1 className="mt-1 font-serif text-[22px] font-medium text-ink">
            Server-enforced. Audit-logged.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Pill label="Allowed" value={AUDIT_EVENTS.slice(0, shown).filter(e => e.result === "allowed").length} tone="success" />
          <Pill label="Denied" value={AUDIT_EVENTS.slice(0, shown).filter(e => e.result === "denied").length} tone="danger" />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {AUDIT_EVENTS.slice(0, shown).map((event, idx) => (
              <motion.li
                key={`${event.time}-${event.who}`}
                initial={{ opacity: 0, x: -12, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2.5 text-[12px]",
                  event.result === "denied"
                    ? "border-danger-border/60 bg-danger-bg/30"
                    : "border-border-default bg-card-warm",
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    event.result === "denied"
                      ? "bg-danger-bg text-danger-fg"
                      : "bg-success-bg text-success-fg",
                  )}
                >
                  {event.result === "denied" ? (
                    <ShieldX className="size-3.5" strokeWidth={2.2} />
                  ) : (
                    <Check className="size-3.5" strokeWidth={2.6} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-ink">
                    <span className="font-medium">{event.who}</span>
                    <span className="text-subtle"> ({event.whoRole}) · </span>
                    <span className="text-ink-warm">{event.action} </span>
                    <span className="font-medium text-ink">{event.resource}</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px] font-medium",
                    event.result === "denied"
                      ? "bg-danger-bg text-danger-fg"
                      : "bg-success-bg text-success-fg",
                  )}
                >
                  {event.result}
                </span>
                <span className="font-mono text-[10px] text-subtle min-w-[80px] text-right">
                  {event.time}
                </span>
                {idx === shown - 1 ? null : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        tone === "success"
          ? "border-success-border/70 bg-success-bg/40"
          : "border-danger-border/70 bg-danger-bg/40",
      )}
    >
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.14em]",
          tone === "success" ? "text-success-fg" : "text-danger-fg",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[11.5px] font-medium",
          tone === "success" ? "text-success-fg" : "text-danger-fg",
        )}
      >
        {value}
      </span>
    </div>
  );
}
