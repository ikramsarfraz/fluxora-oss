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

import type { SettingsGroup, SettingsIconKey } from "./settings-groups";

const ICONS: Record<SettingsIconKey, LucideIcon> = {
  home: Home,
  "layout-grid": LayoutGrid,
  ruler: Ruler,
  users: Users,
  shield: Shield,
  landmark: Landmark,
  key: Key,
  webhook: Webhook,
  "scroll-text": ScrollText,
  "credit-card": CreditCard,
};

export function SettingsSubNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="sticky top-0 flex h-[calc(100dvh-4rem)] w-[220px] shrink-0 flex-col gap-0 border-r border-border-default bg-card px-3.5 py-6"
      aria-label="Settings"
    >
      <h2 className="px-2 pb-3.5 text-[18px] font-medium tracking-[-0.02em] text-ink">
        Settings
      </h2>

      <nav className="flex flex-col">
        {groups
          .filter(g => g.visible)
          .map(group => (
            <div key={group.key} className="flex flex-col">
              <div className="px-2 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {group.label}
              </div>
              {group.items.map(item => {
                const Icon = ICONS[item.icon];
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-ink-warm hover:bg-divider",
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
                            : "bg-divider text-subtle",
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
