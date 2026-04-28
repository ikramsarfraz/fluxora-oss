import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  listTenantSupportTickets,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
} from "@/services/support";

export default async function SupportPage() {
  const tickets = await listTenantSupportTickets();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Support"
        description="Track your submitted reports and progress from the platform team."
      >
        <Button asChild>
          <Link href="/support/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New support ticket</span>
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Your support tickets</CardTitle>
          <CardDescription>
            Track submitted reports and progress from the platform team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Issue type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attachments</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length > 0 ? (
                tickets.map(ticket => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/support/${ticket.id}`}
                        className="hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                    </TableCell>
                    <TableCell>{supportIssueTypeLabel(ticket.issueType)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {supportPriorityLabel(ticket.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {supportTicketStatusLabel(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{ticket.attachments.length}</TableCell>
                    <TableCell>{formatDisplayDate(ticket.createdAt)}</TableCell>
                    <TableCell>{formatDisplayDate(ticket.updatedAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    You have not submitted any support tickets yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
