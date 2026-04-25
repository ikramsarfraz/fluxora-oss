import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
} from "@/services/support";

type SearchParams = {
  status?: string;
  priority?: string;
  issueType?: string;
};

function getFilterValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | "all" {
  return value && allowed.includes(value as T) ? (value as T) : "all";
}

function filterHref(next: Partial<SearchParams>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value && value !== "all") {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/admin/support?${query}` : "/admin/support";
}

function FilterPills({
  label,
  param,
  current,
  options,
  currentFilters,
}: {
  label: string;
  param: keyof SearchParams;
  current: string;
  options: readonly { value: string; label: string }[];
  currentFilters: SearchParams;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {[{ value: "all", label: "All" }, ...options].map(option => (
          <Link
            key={option.value}
            href={filterHref({
              ...currentFilters,
              [param]: option.value,
            })}
            className={
              current === option.value
                ? "rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-slate-400 hover:text-foreground"
            }
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function PlatformAdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = getFilterValue(
    params.status,
    SUPPORT_TICKET_STATUSES.map(item => item.value),
  );
  const priority = getFilterValue(
    params.priority,
    SUPPORT_PRIORITIES.map(item => item.value),
  );
  const issueType = getFilterValue(
    params.issueType,
    SUPPORT_ISSUE_TYPES.map(item => item.value),
  );
  const currentFilters: SearchParams = { status, priority, issueType };
  const tickets = await listPlatformSupportTickets({
    status: status as SupportTicketStatus | "all",
    priority: priority as SupportPriority | "all",
    issueType: issueType as SupportIssueType | "all",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Support tickets</CardTitle>
          <CardDescription>
            Lightweight issue reports submitted by tenant users during testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <FilterPills
              label="Status"
              param="status"
              current={status}
              options={SUPPORT_TICKET_STATUSES}
              currentFilters={currentFilters}
            />
            <FilterPills
              label="Priority"
              param="priority"
              current={priority}
              options={SUPPORT_PRIORITIES}
              currentFilters={currentFilters}
            />
            <FilterPills
              label="Issue type"
              param="issueType"
              current={issueType}
              options={SUPPORT_ISSUE_TYPES}
              currentFilters={currentFilters}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Issue type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length > 0 ? (
                tickets.map(ticket => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/support/${ticket.id}`}
                        className="hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {supportIssueTypeLabel(ticket.issueType)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {supportPriorityLabel(ticket.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>{ticket.tenant.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{ticket.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {ticket.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {supportTicketStatusLabel(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDisplayDate(ticket.createdAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No support tickets match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
