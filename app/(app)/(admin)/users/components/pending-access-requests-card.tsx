"use client";

import { Loader2, MailPlus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePendingTenantJoinRequests, useReviewTenantJoinRequest } from "@/hooks/use-users";

function formatRequestedAt(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function PendingAccessRequestsCard() {
  const { data, isLoading, error } = usePendingTenantJoinRequests();
  const reviewRequest = useReviewTenantJoinRequest();

  async function handleReview(id: string, decision: "approve" | "reject") {
    try {
      await reviewRequest.mutateAsync({ id, decision });
      toast.success(
        decision === "approve"
          ? "Access request approved."
          : "Access request rejected.",
      );
    } catch (reviewError) {
      toast.error(
        reviewError instanceof Error
          ? reviewError.message
          : "Failed to review access request.",
      );
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Access Requests</CardTitle>
          <CardDescription>Loading access requests…</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Checking for pending tenant access requests.
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Access Requests</CardTitle>
          <CardDescription>
            Access requests could not be loaded right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-rose-600">
          {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Access Requests</CardTitle>
          <CardDescription>
            Tenant self-join is disabled. New access shows up here for admin review.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-600">
          <ShieldCheck className="size-5 text-slate-400" />
          No pending access requests right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Access Requests</CardTitle>
        <CardDescription>
          Approving creates or reactivates tenant access after server-side validation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(request => {
                const isMutating =
                  reviewRequest.isPending &&
                  reviewRequest.variables?.id === request.id;

                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-900">
                          {request.fullName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                          <MailPlus className="size-3.5" />
                          {request.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {request.requestedRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatRequestedAt(request.requestedAt)}
                    </TableCell>
                    <TableCell className="max-w-[240px] text-sm text-slate-600">
                      {request.note?.trim() ? request.note : "No note provided"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => handleReview(request.id, "reject")}
                        >
                          <UserX className="size-4" />
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isMutating}
                          onClick={() => handleReview(request.id, "approve")}
                        >
                          <UserCheck className="size-4" />
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
