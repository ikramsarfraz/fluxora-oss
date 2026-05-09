"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateSupportTicketStatusAction } from "@/modules/core/platform-admin/support/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPORT_TICKET_STATUSES,
  type SupportTicketStatus,
} from "@/lib/support/metadata";

export function TicketStatusForm({
  ticketId,
  status,
}: {
  ticketId: string;
  status: SupportTicketStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={isPending}
      onValueChange={value => {
        startTransition(async () => {
          try {
            await updateSupportTicketStatusAction(
              ticketId,
              value as SupportTicketStatus,
            );
            toast.success("Ticket status updated.");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not update ticket status.",
            );
          }
        });
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORT_TICKET_STATUSES.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
