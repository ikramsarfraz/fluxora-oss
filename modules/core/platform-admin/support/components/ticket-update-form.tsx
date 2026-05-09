"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addPlatformSupportTicketUpdateAction,
  uploadPlatformSupportTicketAttachmentAction,
} from "@/modules/core/platform-admin/support/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SupportTicketUpdateVisibility } from "@/lib/support/metadata";

export function TicketUpdateForm({
  ticketId,
  visibility,
}: {
  ticketId: string;
  visibility: SupportTicketUpdateVisibility;
}) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const isTenantVisible = visibility === "tenant_visible";

  return (
    <form
      className="space-y-3"
      onSubmit={event => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const update = await addPlatformSupportTicketUpdateAction({
              ticketId,
              message,
              visibility,
            });
            for (const file of attachments) {
              const formData = new FormData();
              formData.append("file", file);
              await uploadPlatformSupportTicketAttachmentAction(
                ticketId,
                update.id,
                formData,
              );
            }
            setMessage("");
            setAttachments([]);
            toast.success(
              isTenantVisible
                ? "Tenant-visible update added."
                : "Internal note added.",
            );
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
        placeholder={
          isTenantVisible
            ? "Write an update the tenant can see..."
            : "Write an internal support note..."
        }
      />
      <Input
        type="file"
        multiple
        onChange={event =>
          setAttachments(Array.from(event.target.files ?? []))
        }
      />
      <Button type="submit" disabled={isPending || message.trim().length === 0}>
        {isPending
          ? "Adding..."
          : isTenantVisible
            ? "Add tenant-visible update"
            : "Add internal note"}
      </Button>
    </form>
  );
}
