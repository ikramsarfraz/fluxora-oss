import {
  humanizeAuditAction,
  listRecentAuditEventsForTenant,
} from "@/lib/audit-log";
import { requireAdminPortalUser } from "@/modules/shared/services/portal-users";

const PAGE_SIZE = 50;

function formatTimestamp(ts: Date | string): string {
  const date = typeof ts === "string" ? new Date(ts) : ts;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
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

export default async function AuditLogPage() {
  const admin = await requireAdminPortalUser();
  const events = await listRecentAuditEventsForTenant(admin.tenantId, PAGE_SIZE);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#1c1917", margin: 0 }}>
          Activity log
        </h1>
        <p style={{ marginTop: 8, color: "#78716c", fontSize: 14 }}>
          Append-only record of destructive and sensitive actions taken by
          users in this workspace. Showing the most recent {PAGE_SIZE} events.
        </p>
      </header>

      {events.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            color: "#a8a29e",
            border: "1px solid #e7e5e4",
            borderRadius: 8,
            background: "#fafaf9",
          }}
        >
          No audit events recorded yet.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #e7e5e4",
            borderRadius: 8,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#fafaf9", borderBottom: "1px solid #e7e5e4" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#57534e", fontWeight: 500 }}>
                  When
                </th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#57534e", fontWeight: 500 }}>
                  Actor
                </th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#57534e", fontWeight: 500 }}>
                  Action
                </th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#57534e", fontWeight: 500 }}>
                  Resource
                </th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#57534e", fontWeight: 500 }}>
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id} style={{ borderBottom: "1px solid #f5f5f4" }}>
                  <td style={{ padding: "12px 16px", color: "#1c1917", whiteSpace: "nowrap" }}>
                    {formatTimestamp(event.occurredAt)}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#44403c" }}>
                    {event.actorEmail ?? event.actorUserId}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#1c1917" }}>
                    {humanizeAuditAction(event.action)}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#78716c", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                    {event.resourceType}
                    {event.resourceId ? ` · ${event.resourceId.slice(0, 8)}` : ""}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#78716c", fontSize: 13 }}>
                    {renderMetadata(event.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "#a8a29e" }}>
        Audit entries are append-only. Filters, full pagination, and CSV export
        are planned for a follow-up.
      </p>
    </div>
  );
}
