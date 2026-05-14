"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Home,
  Key,
  Landmark,
  LayoutGrid,
  Ruler,
  ScrollText,
  Shield,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type SettingsGroupKey = "workspace" | "team" | "integrations" | "security" | "billing";

export type SettingsLeaf = {
  /** Sub-nav label. */
  label: string;
  /** Full URL. */
  href: string;
  icon: LucideIcon;
  /** Right-side badge — number (e.g. "1") or the literal "soon". */
  badge?: string;
  /** Reserved/coming-soon items still render as a link but the page itself is a stub. */
  soon?: boolean;
};

export type SettingsGroup = {
  key: SettingsGroupKey;
  label: string;
  /** When false (member role), the group is hidden + each leaf renders a 403. */
  visible: boolean;
  items: SettingsLeaf[];
};

export function buildSettingsGroups(opts: {
  /** Owner+admin gets every group; everyone else sees Workspace only. */
  canManageWorkspace: boolean;
  pendingInviteCount?: number;
  connectedBankCount?: number;
}): SettingsGroup[] {
  return [
    {
      key: "workspace",
      label: "Workspace",
      visible: true,
      items: [
        { label: "General", href: "/settings/workspace/general", icon: Home },
        { label: "Categories", href: "/settings/workspace/categories", icon: LayoutGrid },
        { label: "Units of Measure", href: "/settings/workspace/units-of-measure", icon: Ruler },
      ],
    },
    {
      key: "team",
      label: "Team",
      visible: opts.canManageWorkspace,
      items: [
        {
          label: "Members",
          href: "/settings/team/members",
          icon: Users,
          badge:
            opts.pendingInviteCount && opts.pendingInviteCount > 0
              ? String(opts.pendingInviteCount)
              : undefined,
        },
        { label: "Roles & Permissions", href: "/settings/team/roles", icon: Shield },
      ],
    },
    {
      key: "integrations",
      label: "Integrations",
      visible: opts.canManageWorkspace,
      items: [
        {
          label: "Banks",
          href: "/settings/integrations/banks",
          icon: Landmark,
          badge:
            opts.connectedBankCount && opts.connectedBankCount > 0
              ? String(opts.connectedBankCount)
              : undefined,
        },
        { label: "API keys", href: "/settings/integrations/api-keys", icon: Key, badge: "soon", soon: true },
        { label: "Webhooks", href: "/settings/integrations/webhooks", icon: Webhook, badge: "soon", soon: true },
      ],
    },
    {
      key: "security",
      label: "Security",
      visible: opts.canManageWorkspace,
      items: [
        { label: "Activity log", href: "/settings/security/activity-log", icon: ScrollText },
      ],
    },
    {
      key: "billing",
      label: "Billing",
      visible: opts.canManageWorkspace,
      items: [
        {
          label: "Plan & usage",
          href: "/settings/billing/plan-and-usage",
          icon: CreditCard,
          badge: "soon",
          soon: true,
        },
      ],
    },
  ];
}

export function SettingsSubNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="sticky top-0 flex h-[calc(100dvh-4rem)] w-[220px] shrink-0 flex-col gap-0 border-r border-stone-line bg-stone-surface px-3.5 py-6"
      aria-label="Settings"
    >
      <h2 className="px-2 pb-3.5 text-[18px] font-semibold tracking-[-0.02em] text-stone-ink">
        Settings
      </h2>

      <nav className="flex flex-col">
        {groups
          .filter(g => g.visible)
          .map(group => (
            <div key={group.key} className="flex flex-col">
              <div className="px-2 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
                {group.label}
              </div>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-stone-ink2 hover:bg-stone-line2",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="size-[14px] shrink-0" strokeWidth={1.8} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[10px] font-medium",
                          item.soon
                            ? "bg-primary/10 text-primary"
                            : "bg-stone-line2 text-stone-muted",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
      </nav>
    </aside>
  );
}
