"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SettingsGroup } from "./settings-groups";

export function SettingsBreadcrumb({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname() ?? "";

  let groupLabel: string | null = null;
  let leafLabel: string | null = null;
  let groupHref: string | null = null;

  for (const group of groups) {
    const match = group.items.find(item => item.href === pathname);
    if (match) {
      groupLabel = group.label;
      leafLabel = match.label;
      groupHref = group.items[0]?.href ?? null;
      break;
    }
  }

  return (
    <div className="flex h-[45px] items-center gap-1.5 border-b border-stone-line bg-stone-surface px-6 text-[14px]">
      <Link
        href="/settings"
        className="text-stone-muted underline-offset-2 transition-colors hover:text-stone-ink hover:underline"
      >
        Settings
      </Link>
      {groupLabel ? (
        <>
          <span className="px-1.5 text-stone-line" aria-hidden>
            /
          </span>
          {groupHref ? (
            <Link
              href={groupHref}
              className="text-stone-muted underline-offset-2 transition-colors hover:text-stone-ink hover:underline"
            >
              {groupLabel}
            </Link>
          ) : (
            <span className="text-stone-muted">{groupLabel}</span>
          )}
        </>
      ) : null}
      {leafLabel ? (
        <>
          <span className="px-1.5 text-stone-line" aria-hidden>
            /
          </span>
          <span className="font-medium text-stone-ink">{leafLabel}</span>
        </>
      ) : null}
    </div>
  );
}
