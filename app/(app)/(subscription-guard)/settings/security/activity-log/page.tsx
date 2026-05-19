import { FeatureOpenedBeacon } from "@/components/feature-opened-beacon";
import {
  humanizeAuditAction,
  listRecentAuditEventsForTenant,
} from "@/lib/audit-log";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";

const PAGE_SIZE = 50;

function formatTimestamp(ts: Date | string): { date: string; time: string } {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const date = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return { date, time };
}

function renderMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      const value =
        typeof v === "string"
          ? v
          : v == null
            ? "—"
            : JSON.stringify(v);
      return `${k}: ${value}`;
    })
    .join(" · ");
}

export default async function ActivityLogSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Activity log" />;
  }
  const events = await listRecentAuditEventsForTenant(current.tenantId, PAGE_SIZE);

  return (
    <div>
      <FeatureOpenedBeacon feature="audit_log" />
      <SettingsPageHeader
        title="Activity log"
        description={`Append-only record of destructive and sensitive actions in this workspace. Showing the most recent ${PAGE_SIZE} events.`}
      />

      {events.length === 0 ? (
        <div className="rounded-[10px] border border-border-default bg-page px-6 py-12 text-center text-[13px] text-subtle">
          No audit events recorded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border-default bg-card">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-divider/60">
                {(["When", "Actor", "Action", "Resource", "Details"] as const).map(label => (
                  <th
                    key={label}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-subtle"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(event => {
                const ts = formatTimestamp(event.occurredAt);
                const isDestructive = event.action.includes("delete");
                return (
                  <tr
                    key={event.id}
                    className="border-t border-divider align-top"
                  >
                    <td className="px-4 py-2.5 font-mono text-ink-warm">
                      <div>{ts.date}</div>
                      <div className="text-subtle">{ts.time}</div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-warm">
                      {event.actorEmail ?? event.actorUserId}
                    </td>
                    <td
                      className="px-4 py-2.5 font-medium"
                      style={isDestructive ? { color: "oklch(45% 0.16 25)" } : undefined}
                    >
                      {humanizeAuditAction(event.action)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-subtle">
                      {event.resourceType}
                      {event.resourceId ? ` · ${event.resourceId.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink-warm">
                      {renderMetadata(event.metadata)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[12px] text-subtle">
        Audit entries are append-only. Filters, full pagination, and CSV export are planned for a follow-up.
      </p>
    </div>
  );
}
