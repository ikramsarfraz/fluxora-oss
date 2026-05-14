"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  deriveRoleLevels,
  ROLE_ORDER,
  summariseRole,
} from "@/lib/auth/permission-levels";
import type { PortalUserRole } from "@/lib/auth/permissions";
import { RoleIcon } from "./role-icon";

export type RoleRailItem = {
  role: PortalUserRole;
  displayName: string;
  memberCount: number;
};

export function RoleListRail({
  items,
  activeRole,
  onSelect,
  onNewRole,
}: {
  items: RoleRailItem[];
  activeRole: PortalUserRole;
  onSelect: (role: PortalUserRole) => void;
  onNewRole?: () => void;
}) {
  const [query, setQuery] = useState("");

  const byRole = useMemo(() => {
    const map = new Map<PortalUserRole, RoleRailItem>();
    for (const item of items) map.set(item.role, item);
    return map;
  }, [items]);

  const visibleRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROLE_ORDER;
    return ROLE_ORDER.filter(r => {
      const item = byRole.get(r);
      if (!item) return false;
      return item.displayName.toLowerCase().includes(q);
    });
  }, [byRole, query]);

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-stone-line bg-stone-surface px-3.5 py-5">
      <div className="flex items-center justify-between px-2 pb-3">
        <span className="text-[16px] font-semibold tracking-[-0.01em] text-stone-ink">Roles</span>
        <span className="text-[11px] text-stone-muted">{ROLE_ORDER.length} total</span>
      </div>

      <div className="relative mx-1.5 mb-3">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-[13px] -translate-y-1/2 text-stone-muted"
          strokeWidth={1.8}
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search roles…"
          aria-label="Search roles"
          className={cn(
            "w-full rounded-md border border-stone-line bg-stone-surface py-1.5 pl-7 pr-2 text-[12px]",
            "placeholder:text-stone-muted",
            "focus-visible:border-stone-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-stone-line2",
          )}
        />
      </div>

      <div className="flex flex-1 flex-col gap-px overflow-y-auto">
        <RailSectionHeading label="System" count={visibleRoles.length} />
        {visibleRoles.map(role => {
          const item = byRole.get(role);
          if (!item) return null;
          const levels = deriveRoleLevels(role);
          const summary = summariseRole(role, levels);
          const isActive = role === activeRole;
          return (
            <button
              key={role}
              type="button"
              onClick={() => onSelect(role)}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-stone-ink2 hover:bg-stone-line2",
              )}
              aria-current={isActive ? "true" : undefined}
            >
              <RoleIcon role={role} active={isActive} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{item.displayName}</div>
                <div
                  className={cn(
                    "mt-px truncate text-[11px]",
                    isActive ? "text-primary/70" : "text-stone-muted",
                  )}
                >
                  {item.memberCount} member{item.memberCount === 1 ? "" : "s"} · {summary}
                </div>
              </div>
              <Lock
                className={cn("size-3 shrink-0", isActive ? "text-primary/70" : "text-stone-muted")}
                aria-hidden
                strokeWidth={1.8}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-auto border-t border-dashed border-stone-line pt-3">
        <button
          type="button"
          onClick={onNewRole}
          disabled={!onNewRole}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-stone-line bg-transparent px-3 py-2 text-[12px] font-medium text-stone-muted transition-colors",
            onNewRole
              ? "hover:border-stone-ink hover:bg-stone-line2 hover:text-stone-ink"
              : "cursor-not-allowed opacity-70",
          )}
          aria-disabled={!onNewRole}
        >
          <Plus className="size-[14px]" strokeWidth={1.8} />
          New role from template
        </button>
      </div>
    </aside>
  );
}

function RailSectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted">
      <span>{label}</span>
      <span className="font-normal">{count}</span>
    </div>
  );
}
