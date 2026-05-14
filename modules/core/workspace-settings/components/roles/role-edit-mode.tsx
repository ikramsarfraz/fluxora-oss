"use client";

import { Plus, Settings as SettingsIcon, ShoppingCart, Truck, Wallet, Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PERMISSION_GROUPS,
  WORKSPACE_FLAG_LABELS,
  WORKSPACE_FLAG_ORDER,
  type RoleLevels,
} from "@/lib/auth/permission-levels";
import type { PortalUserRole } from "@/lib/auth/permissions";

import { PermissionLevelControl } from "./permission-level-control";
import { WorkspaceToggleRow } from "./workspace-toggle-row";

const GROUP_ICONS = {
  sales: ShoppingCart,
  purchasing: Truck,
  finance: Wallet,
  catalog: Layers,
  workspace: SettingsIcon,
} as const;

export type AssignedMember = {
  id: string;
  fullName: string;
  initials: string;
};

export function RoleEditMode({
  role,
  levels,
  members,
}: {
  role: PortalUserRole;
  levels: RoleLevels;
  members: AssignedMember[];
}) {
  const isSystem = true; // every existing role is system-locked today
  return (
    <div>
      {/* Members strip */}
      <div className="mb-5 flex flex-wrap items-center gap-3.5 rounded-[10px] border border-stone-line bg-stone-surface px-[18px] py-4">
        <div>
          <div className="text-[12px] text-stone-muted">
            <b className="font-semibold text-stone-ink">Assigned to</b>
          </div>
          <div className="text-[11px] text-stone-muted">People in this role today</div>
        </div>
        {members.length === 0 ? (
          <span className="rounded-full border border-dashed border-stone-line px-3 py-1 text-[12px] text-stone-muted">
            No members assigned
          </span>
        ) : (
          members.map(m => (
            <span
              key={m.id}
              className="inline-flex items-center gap-2 rounded-full bg-stone-line2 py-1 pl-1 pr-2.5 text-[12px] text-stone-ink2"
            >
              <span className="grid size-[22px] place-items-center rounded-full bg-stone-ink text-[10px] font-semibold text-stone-surface">
                {m.initials}
              </span>
              {m.fullName}
            </span>
          ))
        )}
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-stone-line bg-stone-surface px-3 py-1 text-[12px] font-medium text-stone-muted"
          title="Editing assignments requires the per-tenant role schema — coming next"
        >
          <Plus className="size-[14px]" strokeWidth={1.8} />
          Assign member
        </button>
      </div>

      {/* Permission groups */}
      <div className="flex flex-col gap-3">
        {PERMISSION_GROUPS.map(group => {
          const Icon = GROUP_ICONS[group.key as keyof typeof GROUP_ICONS] ?? SettingsIcon;
          return (
            <section
              key={group.key}
              className="overflow-hidden rounded-[10px] border border-stone-line bg-stone-surface"
            >
              <header className="flex items-center justify-between gap-3 border-b border-stone-line bg-stone-line2 px-[18px] py-3">
                <div className="flex items-center gap-2.5 text-stone-ink2">
                  <Icon className="size-[14px] shrink-0" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-muted">
                    {group.label}
                  </span>
                  <span className="text-[13px] font-semibold text-stone-ink">
                    {group.resources.length}{" "}
                    {group.resources.length === 1 ? "resource" : "resources"}
                  </span>
                </div>
                <QuickSet />
              </header>
              <div>
                {group.resources.map(resource => (
                  <div
                    key={resource.key}
                    className="grid grid-cols-[1fr_360px] items-center gap-6 border-t border-stone-line2 px-[18px] py-3 first:border-t-0"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-stone-ink">
                        {resource.label}
                      </div>
                      <div className="mt-0.5 text-[12px] text-stone-muted">
                        {resource.description}
                      </div>
                    </div>
                    <PermissionLevelControl
                      value={levels.resources[resource.key]}
                      disabled={isSystem}
                      label={`${resource.label} access level for ${role}`}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Workspace controls (booleans) */}
        <section className="overflow-hidden rounded-[10px] border border-stone-line bg-stone-surface">
          <header className="flex items-center justify-between gap-3 border-b border-stone-line bg-stone-line2 px-[18px] py-3">
            <div className="flex items-center gap-2.5 text-stone-ink2">
              <SettingsIcon className="size-[14px] shrink-0" strokeWidth={1.8} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-muted">
                Workspace controls
              </span>
              <span className="text-[13px] font-semibold text-stone-ink">
                Boolean permissions
              </span>
            </div>
          </header>
          <div>
            {WORKSPACE_FLAG_ORDER.map(flag => (
              <WorkspaceToggleRow
                key={flag}
                label={WORKSPACE_FLAG_LABELS[flag].label}
                description={WORKSPACE_FLAG_LABELS[flag].description}
                enabled={levels.flags[flag]}
                disabled={isSystem}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickSet() {
  // The "Set all:" buttons are visible-only today — they'd dispatch a bulk
  // change once the role schema is editable. Disabled cursor + `aria-disabled`
  // surfaces that intent without removing the affordance from the design.
  return (
    <div className="flex items-center gap-1 text-[11px] text-stone-muted">
      <span>Set all:</span>
      {(["None", "View", "Edit", "Full"] as const).map(label => (
        <button
          key={label}
          type="button"
          disabled
          aria-disabled
          className={cn(
            "rounded px-2 py-0.5 text-[11px] text-stone-ink2",
            "cursor-not-allowed opacity-70",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
