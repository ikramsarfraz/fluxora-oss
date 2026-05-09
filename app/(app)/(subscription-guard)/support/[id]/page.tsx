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
import { SupportTicketAttachments } from "@/modules/core/platform-admin/support/components/support-ticket-attachments";
import { SupportTicketStatusTimeline } from "@/modules/core/platform-admin/support/components/support-ticket-status-timeline";
import { formatDisplayDate } from "@/lib/utils/date";
import { isUuid } from "@/lib/utils/uuid";
import {
  getTenantSupportTicketById,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
} from "@/modules/core/platform-admin/support/services/support";

import { TenantTicketUpdateForm } from "./tenant-ticket-update-form";

function updateAuthor(update: NonNullable<
  Awaited<ReturnType<typeof getTenantSupportTicketById>>
>["updates"][number]) {
  if (update.authorType === "portal_user") {
    return update.authorPortalUser?.fullName ?? "You";
  }
  return update.authorPlatformUser?.authUser.name ?? "Platform support";
}

export default async function TenantSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const ticket = await getTenantSupportTicketById(id);
  if (!ticket) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/support"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Back to support
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {ticket.subject}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Created {formatDisplayDate(ticket.createdAt)}</span>
          <span>•</span>
          <span>Updated {formatDisplayDate(ticket.updatedAt)}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
            <CardDescription>Priority</CardDescription>
            <CardTitle className="text-lg">
              {supportPriorityLabel(ticket.priority)}
            </CardTitle>
          </CardHeader>
        </Card>
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
            <CardDescription>Assigned admin</CardDescription>
            <CardTitle className="text-lg">
              {ticket.assignedPlatformUser?.authUser.name ??
                ticket.assignedPlatformUser?.authUser.email ??
                "Not assigned yet"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Ticket details</CardTitle>
              <CardDescription>
                What you submitted to platform support.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {supportTicketStatusLabel(ticket.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Message</p>
            <p className="mt-1 whitespace-pre-wrap leading-6">{ticket.message}</p>
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
          <SupportTicketAttachments
            ticketId={ticket.id}
            attachments={ticket.attachments}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress updates</CardTitle>
          <CardDescription>
            Tenant-visible updates from support, plus any extra details you add.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.updates.length > 0 ? (
            <div className="space-y-3">
              {ticket.updates.map(update => (
                <div key={update.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{updateAuthor(update)}</span>
                    <span>{formatDisplayDate(update.createdAt)}</span>
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
              No progress updates have been shared yet.
            </p>
          )}
          <TenantTicketUpdateForm ticketId={ticket.id} />
        </CardContent>
      </Card>
    </div>
  );
}
