"use client";

import { useTransition } from "react";
import { toast } from "sonner";

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
  resendPlatformUserInvitationAction,
  revokePlatformUserInvitationAction,
} from "@/modules/core/platform-admin/platform-users/actions";

export type PendingInvitationRow = {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  invitedByName: string | null;
  invitedByEmail: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
};

function roleLabel(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function statusVariant(
  status: PendingInvitationRow["status"],
): "secondary" | "outline" | "destructive" {
  if (status === "pending") return "secondary";
  if (status === "accepted") return "outline";
  return "destructive";
}

export function PendingInvitationsCard({
  rows,
  canManage,
}: {
  rows: PendingInvitationRow[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return null;
  }

  const onRevoke = (id: string, email: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Revoke the invitation for ${email}? The current link will stop working.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await revokePlatformUserInvitationAction({ id });
      if (r.ok) toast.success("Invitation revoked");
      else toast.error(r.message);
    });
  };

  const onResend = (id: string, email: string) => {
    startTransition(async () => {
      const r = await resendPlatformUserInvitationAction({ id });
      if (r.ok) toast.success(`Invitation resent to ${email}`);
      else toast.error(r.message);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
        <CardDescription>
          Pending and recent platform-user invitations. Recipients click the
          link in the email, get signed in via Better Auth magic link, and
          land on the admin dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited by</TableHead>
              <TableHead>Expires</TableHead>
              {canManage ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const isPendingRow = row.status === "pending";
              const expired = row.expiresAt < new Date();
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">
                    {row.email}
                  </TableCell>
                  <TableCell className="capitalize">
                    {roleLabel(row.role)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {row.status === "pending" && expired
                        ? "expired"
                        : row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.invitedByName ?? row.invitedByEmail ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDisplayDate(row.expiresAt)}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {isPendingRow && !expired ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => onResend(row.id, row.email)}
                          >
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => onRevoke(row.id, row.email)}
                          >
                            Revoke
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
