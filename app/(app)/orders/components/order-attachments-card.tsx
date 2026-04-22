"use client";

import { Paperclip, UploadCloud } from "lucide-react";

import { DetailSection } from "@/components/detail-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { SalesOrderDetail } from "@/services/orders";

interface OrderAttachmentsCardProps {
  order: SalesOrderDetail;
}

export function OrderAttachmentsCard({ order }: OrderAttachmentsCardProps) {
  return (
    <DetailSection
      title="Attachments"
      description="Operational files and supporting documents for this sales order."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-dashed bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-muted p-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Attachment workspace</p>
                <Badge variant="outline" className="text-[10px] uppercase">
                  Placeholder
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Use this area for packing sheets, signed PODs, QA photos, and
                customer documents once order-level file support is available.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" disabled>
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload file
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <PlaceholderAttachmentSlot
            title="Packing documents"
            description="Pick tickets, pack sheets, or warehouse paperwork."
          />
          <PlaceholderAttachmentSlot
            title="Delivery proof"
            description="Signed delivery receipts or proof-of-delivery photos."
          />
          <PlaceholderAttachmentSlot
            title="Supporting files"
            description="Customer emails, QA documentation, or special handling notes."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Order {order.orderNumber ?? order.id.slice(0, 8)} does not currently
          have a dedicated attachments relation in the backend, so this section
          is a structured placeholder.
        </p>
      </div>
    </DetailSection>
  );
}

function PlaceholderAttachmentSlot({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-1 text-sm font-medium">{title}</div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
