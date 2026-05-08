"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { assignSupportTicketAction } from "@/actions/support";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssigneeOption {
  id: string;
  label: string;
}

export function TicketAssignmentForm({
  ticketId,
  assignedPlatformUserId,
  users,
}: {
  ticketId: string;
  assignedPlatformUserId: string | null;
  users: AssigneeOption[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={assignedPlatformUserId ?? "unassigned"}
      disabled={isPending}
      onValueChange={value => {
        startTransition(async () => {
          try {
            await assignSupportTicketAction(
              ticketId,
              value === "unassigned" ? null : value,
            );
            toast.success(
              value === "unassigned" ? "Ticket unassigned." : "Ticket assigned.",
            );
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not update assignment.",
            );
          }
        });
      }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {users.map(user => (
          <SelectItem key={user.id} value={user.id}>
            {user.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
