import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminDetailHeader } from "@/modules/core/platform-admin/components/admin-detail-header";
import {
  DefList,
  DefRow,
  DetailGrid,
  DetailRail,
  Pill,
  type PillTone,
  RailCard,
} from "@/modules/core/platform-admin/components/admin-ui";
import { BreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { PLATFORM_SUPPORT_ROLES } from "@/modules/core/platform-admin/support/permissions";
import { SupportTicketAttachments } from "@/modules/core/platform-admin/support/components/support-ticket-attachments";
import { SupportTicketStatusTimeline } from "@/modules/core/platform-admin/support/components/support-ticket-status-timeline";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";
import { formatDisplayDate } from "@/lib/utils/date";
import { isUuid } from "@/lib/utils/uuid";
import {
  getPlatformSupportTicketById,
  listAssignablePlatformUsers,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
  supportTicketUpdateVisibilityLabel,
} from "@/modules/core/platform-admin/support/services/support";
import { TicketAssignmentForm } from "@/modules/core/platform-admin/support/components/ticket-assignment-form";
import { TicketStatusForm } from "@/modules/core/platform-admin/support/components/ticket-status-form";
import { TicketUpdateForm } from "@/modules/core/platform-admin/support/components/ticket-update-form";

function updateAuthor(update: NonNullable<
  Awaited<ReturnType<typeof getPlatformSupportTicketById>>
>["updates"][number]) {
  if (update.authorType === "portal_user") {
    return update.authorPortalUser?.fullName ?? "Tenant user";
  }
  return update.authorPlatformUser?.authUser.name ?? "Platform support";
}

const PRIORITY_TONE: Record<string, PillTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  urgent: "danger",
};

const STATUS_TONE: Record<string, PillTone> = {
  open: "neutral",
  in_progress: "info",
  resolved: "success",
  closed: "outline",
};

const VISIBILITY_TONE: Record<string, PillTone> = {
  internal: "outline",
  tenant_visible: "info",
};

export default async function PlatformAdminSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  await requirePlatformUserInRoles(PLATFORM_SUPPORT_ROLES);

  const [ticket, assignableUsers] = await Promise.all([
    getPlatformSupportTicketById(id),
    listAssignablePlatformUsers(),
  ]);
  if (!ticket) {
    notFound();
  }
  const assigneeOptions = assignableUsers.map(user => ({
    id: user.id,
    label: user.authUser.name ?? user.authUser.email,
  }));

  return (
    <div className="space-y-6">
      <BreadcrumbLabel
        href={`/admin/support/${ticket.id}`}
        label={`TKT-${ticket.id.slice(0, 8).toUpperCase()}`}
      />
      <AdminDetailHeader
        backHref="/admin/support"
        backLabel="Back to support tickets"
        title={ticket.subject}
        subtitle={
          <>
            <span>{ticket.tenant.name}</span>
            <span>•</span>
            <span>{formatDisplayDate(ticket.createdAt)}</span>
            <span>•</span>
            <span>Updated {formatDisplayDate(ticket.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Pill tone={STATUS_TONE[ticket.status] ?? "neutral"}>
              {supportTicketStatusLabel(ticket.status)}
            </Pill>
            <TicketStatusForm ticketId={ticket.id} status={ticket.status} />
            <TicketAssignmentForm
              ticketId={ticket.id}
              assignedPlatformUserId={ticket.assignedPlatformUserId}
              users={assigneeOptions}
            />
          </>
        }
      />

      <DetailGrid>
        {/* Main column — the conversation / workflow */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
              <CardDescription>
                Full issue details submitted by the tenant user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6">{ticket.message}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status timeline</CardTitle>
              <CardDescription>
                Current support progress for this ticket.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupportTicketStatusTimeline status={ticket.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Updates and notes</CardTitle>
              <CardDescription>
                Internal notes stay on the platform side. Tenant-visible updates
                appear on the tenant ticket detail page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border-border-soft bg-card space-y-3 rounded-lg border-[0.5px] p-4">
                  <div>
                    <p className="font-medium text-ink">Internal note</p>
                    <p className="text-[13px] text-subtle">
                      For platform support context only.
                    </p>
                  </div>
                  <TicketUpdateForm ticketId={ticket.id} visibility="internal" />
                </div>
                <div className="border-border-soft bg-card space-y-3 rounded-lg border-[0.5px] p-4">
                  <div>
                    <p className="font-medium text-ink">Tenant-visible update</p>
                    <p className="text-[13px] text-subtle">
                      This will be shown to the tenant on their ticket page.
                    </p>
                  </div>
                  <TicketUpdateForm
                    ticketId={ticket.id}
                    visibility="tenant_visible"
                  />
                </div>
              </div>

              {ticket.updates.length > 0 ? (
                <div className="space-y-3">
                  {ticket.updates.map(update => (
                    <div
                      key={update.id}
                      className="border-border-soft bg-card rounded-lg border-[0.5px] p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 text-sm">
                          <span className="font-medium text-ink">
                            {updateAuthor(update)}
                          </span>
                          <span className="font-mono text-xs text-subtle">
                            {formatDisplayDate(update.createdAt)}
                          </span>
                        </div>
                        <Pill
                          tone={VISIBILITY_TONE[update.visibility] ?? "outline"}
                          dot={false}
                        >
                          {supportTicketUpdateVisibilityLabel(update.visibility)}
                        </Pill>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-warm">
                        {update.message}
                      </p>
                      <div className="mt-3">
                        <SupportTicketAttachments
                          ticketId={ticket.id}
                          attachments={update.attachments}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No updates or internal notes have been added yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary rail — ticket facts */}
        <DetailRail aria-label="Ticket summary">
          <RailCard title="Ticket">
            <DefList>
              <DefRow
                label="Issue type"
                value={supportIssueTypeLabel(ticket.issueType)}
              />
              <DefRow
                label="Priority"
                value={
                  <Pill tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}>
                    {supportPriorityLabel(ticket.priority)}
                  </Pill>
                }
              />
              <DefRow
                label="Status"
                value={
                  <Pill tone={STATUS_TONE[ticket.status] ?? "neutral"}>
                    {supportTicketStatusLabel(ticket.status)}
                  </Pill>
                }
              />
              <DefRow
                label="Assigned"
                value={
                  ticket.assignedPlatformUser?.authUser.name ??
                  ticket.assignedPlatformUser?.authUser.email ??
                  "Unassigned"
                }
              />
            </DefList>
          </RailCard>

          <RailCard title="Submitted">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-subtle">Tenant</p>
                <p className="text-sm text-ink">{ticket.tenant.name}</p>
                <p className="font-mono text-xs text-subtle">{ticket.tenant.slug}</p>
              </div>
              <div>
                <p className="text-xs text-subtle">Submitted by</p>
                <p className="text-sm text-ink">{ticket.name}</p>
                <p className="font-mono text-xs text-subtle">{ticket.email}</p>
              </div>
              <div>
                <p className="text-xs text-subtle">Portal user</p>
                <p className="text-sm text-ink">
                  {ticket.portalUser?.fullName ?? "Not linked"}
                </p>
                <p className="font-mono text-xs text-subtle">
                  {ticket.portalUser?.email ?? ticket.portalUserId ?? "No portal user"}
                </p>
              </div>
              <DefList>
                <DefRow label="Created" mono value={formatDisplayDate(ticket.createdAt)} />
                <DefRow label="Updated" mono value={formatDisplayDate(ticket.updatedAt)} />
              </DefList>
            </div>
          </RailCard>

          <RailCard title="Context">
            <div className="mb-4">
              <p className="mb-1 text-xs text-subtle">Page URL</p>
              {ticket.pageUrl ? (
                <Link
                  href={ticket.pageUrl}
                  className="font-mono text-xs break-all text-forest hover:underline"
                >
                  {ticket.pageUrl}
                </Link>
              ) : (
                <p className="text-sm text-subtle">Not provided</p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs text-subtle">Attachments</p>
              <SupportTicketAttachments
                ticketId={ticket.id}
                attachments={ticket.attachments}
              />
            </div>
          </RailCard>
        </DetailRail>
      </DetailGrid>
    </div>
  );
}
