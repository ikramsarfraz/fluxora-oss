"use client";

import { useMemo } from "react";

import {
  PERMISSION_GROUPS,
  WORKSPACE_FLAG_LABELS,
  WORKSPACE_FLAG_ORDER,
  deriveRoleLevels,
  ROLE_ORDER,
} from "@/lib/auth/permission-levels";
import type { PortalUserRole } from "@/lib/auth/permissions";

import { PermissionLevelChip } from "./permission-level-control";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Compare mode — roles-as-columns matrix. Read-only by design: editing
 * always happens via Edit mode on a single role (per handoff).
 */
export function RoleCompareMode() {
  const matrix = useMemo(() => {
    return ROLE_ORDER.map(role => ({
      role,
      levels: deriveRoleLevels(role),
    }));
  }, []);

  return (
    <div className="overflow-hidden rounded-[10px] border border-stone-line bg-stone-surface">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-stone-line2">
            <th className="px-3.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-muted">
              Resource
            </th>
            {matrix.map(({ role }) => (
              <th
                key={role}
                className="px-3.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-muted"
              >
                {capitalize(role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map(group => (
            <Group key={group.key} label={group.label}>
              {group.resources.map(resource => (
                <tr key={resource.key} className="border-t border-stone-line2">
                  <td className="px-3.5 py-2.5">
                    <div className="text-[13px] font-medium text-stone-ink">
                      {resource.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-stone-muted">
                      {resource.description}
                    </div>
                  </td>
                  {matrix.map(({ role, levels }) => (
                    <td key={role} className="px-3.5 py-2.5">
                      <PermissionLevelChip value={levels.resources[resource.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </Group>
          ))}

          <Group label="Workspace controls">
            {WORKSPACE_FLAG_ORDER.map(flag => (
              <tr key={flag} className="border-t border-stone-line2">
                <td className="px-3.5 py-2.5">
                  <div className="text-[13px] font-medium text-stone-ink">
                    {WORKSPACE_FLAG_LABELS[flag].label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-muted">
                    {WORKSPACE_FLAG_LABELS[flag].description}
                  </div>
                </td>
                {matrix.map(({ role, levels }) => (
                  <td key={role} className="px-3.5 py-2.5">
                    <PermissionLevelChip
                      boolean
                      value={levels.flags[flag] ? "yes" : "no"}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </Group>
        </tbody>
      </table>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const colSpan = ROLE_ORDER.length + 1;
  return (
    <>
      <tr>
        <td
          colSpan={colSpan}
          className="bg-stone-bg px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-muted"
        >
          {label}
        </td>
      </tr>
      {children}
    </>
  );
}
