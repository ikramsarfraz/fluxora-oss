"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Home,
  Landmark,
  LayoutGrid,
  Ruler,
  ScrollText,
  Shield,
  User,
  Users,
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
  "scroll-text": ScrollText,
  user: User,
  "credit-card": CreditCard,
};

export function SettingsSubNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="sticky top-0 flex h-[calc(100dvh-4rem)] w-[220px] shrink-0 flex-col gap-[2px] border-r-[0.5px] border-border-soft bg-page px-4 py-6"
      aria-label="Settings"
    >
      <div className="px-2 pb-[18px] font-serif text-[22px] font-medium tracking-[-0.02em] text-ink">
        Settings
      </div>

      <nav className="flex flex-col gap-[2px]">
        {groups
          .filter((g) => g.visible)
          .map((group) => (
            <div key={group.key} className="flex flex-col gap-[2px]">
              <div className="px-2 pb-[6px] pt-[14px] text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-[10px] rounded-md px-[10px] py-[7px] text-[13px] transition-colors",
                      isActive
                        ? "bg-forest-tint font-medium text-forest"
                        : "text-ink-warm hover:bg-surface",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon
                      className="size-[14px] shrink-0 opacity-85"
                      strokeWidth={1.5}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="ml-auto rounded-full bg-surface px-[6px] py-px font-mono text-[10px] text-subtle">
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
