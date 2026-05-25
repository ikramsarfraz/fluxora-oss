"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  deriveRoleLevels,
  ROLE_DESCRIPTIONS,
  ROLE_ORDER,
} from "@/lib/auth/permission-levels";
import type { PortalUserRole } from "@/lib/auth/permissions";

import {
  RoleListRail,
  type RoleRailItem,
} from "./role-list-rail";
import { RoleEditMode, type AssignedMember } from "./role-edit-mode";
import { RoleCompareMode } from "./role-compare-mode";

type Mode = "edit" | "compare";

export type RoleMemberSummary = {
  role: PortalUserRole;
  /** Display label override (defaults to capitalized role). */
  displayName?: string;
  members: AssignedMember[];
};

export function RolesPermissionsHub({
  roleMembers,
  defaultRole,
  highlightRole = null,
}: {
  /** Members assigned to each role, computed server-side from portal_users. */
  roleMembers: RoleMemberSummary[];
  /** Where to land when no `?role=` is present. */
  defaultRole: PortalUserRole;
  /** Optional — the viewer's own role (gets the "Current role" pill). */
  highlightRole?: PortalUserRole | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const role = ((params?.get("role") as PortalUserRole | null) ?? defaultRole) as PortalUserRole;
  const mode = ((params?.get("mode") as Mode | null) ?? "edit") as Mode;

  const railItems: RoleRailItem[] = useMemo(() => {
    const byRole = new Map(roleMembers.map(r => [r.role, r] as const));
    return ROLE_ORDER.map(r => ({
      role: r,
      displayName: byRole.get(r)?.displayName ?? capitalize(r),
      memberCount: byRole.get(r)?.members.length ?? 0,
    }));
  }, [roleMembers]);

  const currentMembers = useMemo(() => {
    return roleMembers.find(r => r.role === role)?.members ?? [];
  }, [roleMembers, role]);

  const levels = useMemo(() => deriveRoleLevels(role), [role]);
  const isSystem = true; // every role is system-locked today

  function setParam(key: "role" | "mode", value: string) {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set(key, value);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div>
      <ReadOnlyBanner />

      <div className="grid grid-cols-[260px_1fr] overflow-hidden rounded-[10px] border border-border-default bg-card">
        <RoleListRail
          items={railItems}
          activeRole={role}
          onSelect={r => setParam("role", r)}
          // Custom roles require the role schema — disabled until that lands.
          onNewRole={undefined}
        />

        <main className="min-w-0 overflow-auto px-9 pb-20 pt-7">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border-default pb-4.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[24px] font-semibold tracking-[-0.02em] text-ink">
                  {capitalize(role)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                  <Lock className="size-2.5" strokeWidth={2} />
                  System
                </span>
                <span className="rounded-full bg-[oklch(96%_0.04_155)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[oklch(58%_0.13_155)]">
                  {currentMembers.length}{" "}
                  {currentMembers.length === 1 ? "member" : "members"}
                </span>
                {highlightRole === role ? (
                  <span className="rounded-full bg-divider px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                    Current role
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-[640px] text-[13px] text-subtle">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ModeToggle
                mode={mode}
                onChange={m => setParam("mode", m)}
              />
              <button
                type="button"
                disabled
                title="Duplicating roles needs the per-tenant role schema — coming next"
                className={cn(
                  "rounded-md border border-border-default bg-card px-3.5 py-2 text-[13px] font-medium text-ink-warm",
                  "cursor-not-allowed opacity-70",
                )}
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled
                title="System roles can't be deleted"
                className={cn(
                  "rounded-md border border-border-default bg-card px-3.5 py-2 text-[13px] font-medium",
                  "cursor-not-allowed text-[oklch(55%_0.18_25)] opacity-70",
                )}
              >
                Delete
              </button>
            </div>
          </header>

          {mode === "edit" ? (
            <RoleEditMode role={role} levels={levels} members={currentMembers} />
          ) : (
            <RoleCompareMode />
          )}

          {isSystem && mode === "edit" ? (
            <p className="mt-6 text-[12px] text-subtle">
              Owner / Admin / Sales / Warehouse / Accounting are system roles — their
              permission levels are derived from the current fixed-role rules and can&apos;t
              be edited here yet. Custom roles and editing arrive once the per-tenant role
              schema ships.
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Role view mode"
      className="inline-flex rounded-lg bg-divider p-[3px]"
    >
      {(["edit", "compare"] as const).map(value => (
        <button
          key={value}
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
            mode === value
              ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-ink-warm hover:text-ink",
          )}
        >
          {value === "edit" ? "Edit role" : "Compare"}
        </button>
      ))}
    </div>
  );
}

function ReadOnlyBanner() {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-[oklch(85%_0.04_240)] bg-[oklch(97%_0.02_240)] px-4 py-3 text-[12.5px] text-[oklch(38%_0.12_240)]">
      <Info className="mt-0.5 size-[14px] shrink-0" strokeWidth={2} />
      <div className="min-w-0">
        <strong className="font-semibold">Read-only preview.</strong> The new
        roles UI ships ahead of its schema. Today every role is locked and
        levels are derived from the existing fixed-role rules — once
        per-tenant custom roles land, the segmented controls, member
        assignment, and templates here become editable.
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
