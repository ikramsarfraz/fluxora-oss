import { SettingsPageHeader } from "./settings-page-header";

/**
 * Rendered inside the hub panel when a non-admin tries to deep-link to a gated page.
 * Per the design handoff: don't redirect away from the hub — show 403 in place so the
 * sub-nav stays anchored and the user can pick something they're allowed to visit.
 */
export function SettingsForbidden({ leafLabel }: { leafLabel: string }) {
  return (
    <div>
      <SettingsPageHeader
        title={leafLabel}
        description="You don't have permission to view this page. Ask an owner or admin for access."
      />
      <div className="rounded-[10px] border border-border-default bg-card p-6 text-[13px] text-ink-warm">
        <p className="font-medium text-ink">Restricted</p>
        <p className="mt-1 text-subtle">
          Team, Integrations, Security, and Billing are only available to owners and admins.
        </p>
      </div>
    </div>
  );
}
