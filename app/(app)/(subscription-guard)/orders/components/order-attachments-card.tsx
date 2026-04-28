"use client";

import { useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useUploadSalesOrderAttachment,
  useRemoveSalesOrderAttachment,
} from "@/hooks/use-orders";
import type { SalesOrderDetail } from "@/services/orders";

type Attachment = SalesOrderDetail["attachments"][number];

interface OrderAttachmentsCardProps {
  order: SalesOrderDetail;
}

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(sizeBytes: number | null | undefined): string {
  if (sizeBytes == null) return "-";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OrderAttachmentsCard({ order }: OrderAttachmentsCardProps) {
  const uploadMutation = useUploadSalesOrderAttachment(order.id);
  const removeMutation = useRemoveSalesOrderAttachment(order.id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRemove, setPendingRemove] = useState<Attachment | null>(null);

  const isUploading = uploadMutation.isPending;
  const isRemoving = removeMutation.isPending;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(`File is too large. Max ${MAX_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    try {
      await uploadMutation.mutateAsync(file);
      toast.success(`Uploaded ${file.name}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload attachment.",
      );
    }
  }

  async function handleRemove() {
    if (!pendingRemove) return;
    try {
      await removeMutation.mutateAsync(pendingRemove.file.id);
      toast.success(
        `Removed ${pendingRemove.file.originalFilename ?? "attachment"}.`,
      );
      setPendingRemove(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove attachment.",
      );
    }
  }

  const attachments = order.attachments ?? [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="size-4" />
              Attachments
            </CardTitle>
            <CardDescription>
              Packing sheets, signed proof-of-delivery, QA photos, or other
              supporting documents. Max 25 MB per file.
            </CardDescription>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="border-muted-foreground/25 bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-10 text-center text-sm">
              <FileText className="size-8 opacity-50" />
              <div className="font-medium">No documents attached yet</div>
              <div className="text-xs">
                Use Upload to attach packing sheets, PODs, or other files.
              </div>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {attachments.map(attachment => {
                const file = attachment.file;
                const href = `/api/sales-orders/${order.id}/attachments/${file.id}`;
                const uploader =
                  file.uploadedByUser?.fullName ??
                  file.uploadedByUser?.email ??
                  null;
                return (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {file.originalFilename ?? "attachment"}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {formatSize(file.sizeBytes)}
                          {file.mimeType ? ` · ${file.mimeType}` : ""}
                          {uploader ? ` · ${uploader}` : ""}
                          {` · ${new Date(attachment.createdAt).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4" />
                          Open
                        </a>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`${href}?download=1`}>
                          <Download className="size-4" />
                          Download
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingRemove(attachment)}
                        disabled={isRemoving}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={open => {
          if (!open) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>
                {pendingRemove?.file.originalFilename ?? "this file"}
              </strong>{" "}
              from the order. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving}
              onClick={e => {
                e.preventDefault();
                handleRemove();
              }}
            >
              {isRemoving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
