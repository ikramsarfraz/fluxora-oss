"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addTenantSupportTicketUpdateAction,
  uploadTenantSupportTicketAttachmentAction,
} from "@/actions/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TenantTicketUpdateForm({ ticketId }: { ticketId: string }) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={event => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const update = await addTenantSupportTicketUpdateAction(
              ticketId,
              message,
            );
            for (const file of attachments) {
              const formData = new FormData();
              formData.append("file", file);
              await uploadTenantSupportTicketAttachmentAction(
                ticketId,
                update.id,
                formData,
              );
            }
            setMessage("");
            setAttachments([]);
            toast.success("Update added.");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not add update.",
            );
          }
        });
      }}
    >
      <Textarea
        value={message}
        onChange={event => setMessage(event.target.value)}
        rows={4}
        placeholder="Add any extra details or reproduction steps..."
      />
      <Input
        type="file"
        multiple
        onChange={event =>
          setAttachments(Array.from(event.target.files ?? []))
        }
      />
      <Button type="submit" disabled={isPending || message.trim().length === 0}>
        {isPending ? "Adding..." : "Add update"}
      </Button>
    </form>
  );
}
