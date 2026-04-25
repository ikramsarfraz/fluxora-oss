import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SupportTicketAttachments } from "@/components/support-ticket-attachments";
import { formatDisplayDate } from "@/lib/utils/date";
import { isUuid } from "@/lib/utils/uuid";
import {
  getPlatformSupportTicketById,
  listAssignablePlatformUsers,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
  supportTicketUpdateVisibilityLabel,
} from "@/services/support";

import { TicketAssignmentForm } from "./ticket-assignment-form";
import { TicketStatusForm } from "./ticket-status-form";
import { TicketUpdateForm } from "./ticket-update-form";

function updateAuthor(update: NonNullable<
  Awaited<ReturnType<typeof getPlatformSupportTicketById>>
>["updates"][number]) {
  if (update.authorType === "portal_user") {
    return update.authorPortalUser?.fullName ?? "Tenant user";
  }
  return update.authorPlatformUser?.authUser.name ?? "Platform support";
}

export default async function PlatformAdminSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/admin/support"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Back to support tickets
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {ticket.subject}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{ticket.tenant.name}</span>
            <span>•</span>
            <span>{formatDisplayDate(ticket.createdAt)}</span>
            <span>•</span>
            <span>Updated {formatDisplayDate(ticket.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {supportTicketStatusLabel(ticket.status)}
          </Badge>
          <TicketStatusForm ticketId={ticket.id} status={ticket.status} />
          <TicketAssignmentForm
            ticketId={ticket.id}
            assignedPlatformUserId={ticket.assignedPlatformUserId}
            users={assigneeOptions}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Issue type</CardDescription>
            <CardTitle className="text-lg">
              {supportIssueTypeLabel(ticket.issueType)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Priority</CardDescription>
            <CardTitle className="text-lg">
              {supportPriorityLabel(ticket.priority)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-lg">
              {supportTicketStatusLabel(ticket.status)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Assigned to</CardDescription>
            <CardTitle className="text-lg">
              {ticket.assignedPlatformUser?.authUser.name ??
                ticket.assignedPlatformUser?.authUser.email ??
                "Unassigned"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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
          <CardTitle>Metadata</CardTitle>
          <CardDescription>
            Tenant, submitter, and optional browser context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Tenant</p>
            <p className="font-medium">{ticket.tenant.name}</p>
            <p className="text-xs text-muted-foreground">{ticket.tenant.slug}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Submitted by</p>
            <p className="font-medium">{ticket.name}</p>
            <p className="text-xs text-muted-foreground">{ticket.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Portal user</p>
            <p className="font-medium">
              {ticket.portalUser?.fullName ?? "Not linked"}
            </p>
            <p className="text-xs text-muted-foreground">
              {ticket.portalUser?.email ?? ticket.portalUserId ?? "No portal user"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Assigned platform user</p>
            <p className="font-medium">
              {ticket.assignedPlatformUser?.authUser.name ?? "Unassigned"}
            </p>
            <p className="text-xs text-muted-foreground">
              {ticket.assignedPlatformUser?.authUser.email ?? "No assignee"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Page URL</p>
            {ticket.pageUrl ? (
              <Link
                href={ticket.pageUrl}
                className="break-all font-medium text-blue-700 hover:underline"
              >
                {ticket.pageUrl}
              </Link>
            ) : (
              <p className="font-medium">Not provided</p>
            )}
          </div>
          <div className="md:col-span-2">
            <SupportTicketAttachments
              ticketId={ticket.id}
              attachments={ticket.attachments}
            />
          </div>
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
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">Internal note</p>
                <p className="text-sm text-muted-foreground">
                  For platform support context only.
                </p>
              </div>
              <TicketUpdateForm ticketId={ticket.id} visibility="internal" />
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">Tenant-visible update</p>
                <p className="text-sm text-muted-foreground">
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
                <div key={update.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium">{updateAuthor(update)}</span>
                      <span className="ml-2 text-muted-foreground">
                        {formatDisplayDate(update.createdAt)}
                      </span>
                    </div>
                    <Badge
                      variant={
                        update.visibility === "tenant_visible"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {supportTicketUpdateVisibilityLabel(update.visibility)}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
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
  );
}
