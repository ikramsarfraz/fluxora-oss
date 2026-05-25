"use client";

import { motion } from "motion/react";
import {
  Boxes,
  Check,
  Crown,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  Receipt,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MarketingAppShell } from "./app-shell";

// Roles & permissions moment: full settings page showing the permission
// matrix as a real table. Stays inside the app shell context.

const ROLES = ["Owner", "Admin", "Member", "Warehouse"] as const;
type Role = (typeof ROLES)[number];

type PermRow = {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
    label: "Suppliers",
    icon: Truck,
    access: { Owner: "full", Admin: "full", Member: "read", Warehouse: "read" },
  },
  {
    label: "Inventory",
    icon: Boxes,
    access: { Owner: "full", Admin: "full", Member: "read", Warehouse: "full" },
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

export function RolesMoment() {
  return (
    <MarketingAppShell
      activeNav="dashboard"
      crumbs={["Workspace settings", "Roles & permissions"]}
      label="Roles · server-enforced"
      tone="forest"
      rightSlot={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-tint/60 px-2.5 py-1 font-mono text-[11px] text-forest-mid">
          <Check className="size-3" strokeWidth={2.4} />
          Saved · enforced live
        </span>
      }
    >
      <div className="flex h-full flex-col p-5">
        <div>
          <h2 className="font-serif text-[20px] font-medium tracking-tight text-ink">
            Permission matrix
          </h2>
          <p className="mt-1 text-[12.5px] text-subtle">
            Same workspace. Four different views. Server-enforced row-by-row.
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border-default bg-card-warm">
          <table className="w-full text-[12px]">
            <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Module</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2.5 text-center font-medium">
                    <span className="inline-flex items-center gap-1">
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
              {PERMISSIONS.map((perm, idx) => (
                <motion.tr
                  key={perm.label}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.15 + idx * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="border-t border-border-default"
                >
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <perm.icon
                        className="size-3.5 text-subtle"
                        strokeWidth={1.8}
                      />
                      {perm.label}
                    </span>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      <AccessPill access={perm.access[r]} />
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-forest-tint-deep/60 bg-forest-tint/40 px-3 py-2 text-[12px] font-medium text-forest-mid"
        >
          <Check className="size-3.5" strokeWidth={2.4} />
          Warehouse sees lots &amp; orders only. CFO sees the full P&amp;L.
        </motion.div>
      </div>
    </MarketingAppShell>
  );
}

function AccessPill({ access }: { access: "full" | "read" | "none" }) {
  return (
    <span
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
    </span>
  );
}
