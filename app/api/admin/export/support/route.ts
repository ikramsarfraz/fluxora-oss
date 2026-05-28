import { NextResponse } from "next/server";

import { serializeCsv } from "@/lib/csv/serialize";
import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import { PLATFORM_SUPPORT_ROLES } from "@/modules/core/platform-admin/support/permissions";
import {
  listPlatformSupportTickets,
  SUPPORT_ISSUE_TYPES,
  SUPPORT_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
  type SupportIssueType,
  type SupportPriority,
  type SupportTicketStatus,
} from "@/modules/core/platform-admin/support/services/support";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

const EXPORT_ROW_CAP = 10_000;

const HEADERS = [
  { key: "id" as const, label: "Ticket ID" },
  { key: "subject" as const, label: "Subject" },
  { key: "issueType" as const, label: "Issue type" },
  { key: "priority" as const, label: "Priority" },
  { key: "status" as const, label: "Status" },
  { key: "tenant" as const, label: "Tenant" },
  { key: "submitterName" as const, label: "Submitter name" },
  { key: "submitterEmail" as const, label: "Submitter email" },
  { key: "assignee" as const, label: "Assigned to" },
  { key: "attachmentCount" as const, label: "Attachments" },
  { key: "createdAt" as const, label: "Created (UTC)" },
  { key: "updatedAt" as const, label: "Last updated (UTC)" },
];

function readString(value: string | null): string {
  return value?.trim() ?? "";
}

function filterFromAllowed<T extends string>(
  raw: string,
  allowed: readonly T[],
): T | "all" {
  return allowed.includes(raw as T) ? (raw as T) : "all";
}

function authErrorToStatus(message: string): number {
  if (message === "Unauthorized") return 401;
  if (message.toLowerCase().startsWith("forbidden")) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    await requirePlatformUserInRoles(PLATFORM_SUPPORT_ROLES);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { detail: message, code: "FORBIDDEN" },
      { status: authErrorToStatus(message) },
    );
  }

  const url = new URL(request.url);
  const status = filterFromAllowed(
    readString(url.searchParams.get("status")),
    SUPPORT_TICKET_STATUSES.map(s => s.value),
  );
  const priority = filterFromAllowed(
    readString(url.searchParams.get("priority")),
    SUPPORT_PRIORITIES.map(p => p.value),
  );
  const issueType = filterFromAllowed(
    readString(url.searchParams.get("issueType")),
    SUPPORT_ISSUE_TYPES.map(i => i.value),
  );
  const search = readString(url.searchParams.get("q")) || null;

  recordActionBreadcrumb({
    action: "platform_admin.export_support_csv",
    data: {
      hasSearch: Boolean(search),
      status,
      priority,
      issueType,
    },
  });

  const tickets = await listPlatformSupportTickets(
    {
      status: status as SupportTicketStatus | "all",
      priority: priority as SupportPriority | "all",
      issueType: issueType as SupportIssueType | "all",
      search,
    },
    { limit: EXPORT_ROW_CAP },
  );

  const csvRows = tickets.map(t => ({
    id: t.id,
    subject: t.subject,
    issueType: supportIssueTypeLabel(t.issueType),
    priority: supportPriorityLabel(t.priority),
    status: supportTicketStatusLabel(t.status),
    tenant: t.tenant.name,
    submitterName: t.name,
    submitterEmail: t.email,
    assignee:
      t.assignedPlatformUser?.authUser.name ??
      t.assignedPlatformUser?.authUser.email ??
      "",
    attachmentCount: String(t.attachments.length),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const body = serializeCsv(HEADERS, csvRows);
  const filename = `fluxora-support-tickets-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-export-row-count": String(csvRows.length),
      "x-export-row-cap": String(EXPORT_ROW_CAP),
    },
  });
}
