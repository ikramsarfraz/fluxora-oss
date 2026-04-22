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
  useRemoveSupplierInvoiceAttachment,
  useUploadSupplierInvoiceAttachment,
} from "@/hooks/use-supplier-invoices";
import type { SupplierInvoiceDetail } from "@/services/receiving";

type Attachment = SupplierInvoiceDetail["attachments"][number];

interface SupplierInvoiceAttachmentsCardProps {
  supplierInvoiceId: string;
  attachments: Attachment[];
  canUpload: boolean;
  canRemove: boolean;
  uploadDisabledReason?: string;
  removeDisabledReason?: string;
}

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(sizeBytes: number | null | undefined): string {
  if (sizeBytes == null) return "-";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupplierInvoiceAttachmentsCard({
  supplierInvoiceId,
  attachments,
  canUpload,
  canRemove,
  uploadDisabledReason,
  removeDisabledReason,
}: SupplierInvoiceAttachmentsCardProps) {
  const uploadMutation =
    useUploadSupplierInvoiceAttachment(supplierInvoiceId);
  const removeMutation =
    useRemoveSupplierInvoiceAttachment(supplierInvoiceId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRemove, setPendingRemove] = useState<Attachment | null>(null);

  const isUploading = uploadMutation.isPending;
  const isRemoving = removeMutation.isPending;

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    // Reset the input immediately so the same filename can be re-uploaded.
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(
        `File is too large. Max ${MAX_BYTES / (1024 * 1024)} MB.`,
      );
      return;
    }
    try {
      await uploadMutation.mutateAsync(file);
      toast.success(`Uploaded ${file.name}.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload attachment.";
      toast.error(message);
    }
  }

  function confirmRemove(attachment: Attachment) {
    setPendingRemove(attachment);
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
      const message =
        err instanceof Error
          ? err.message
          : "Failed to remove attachment.";
      toast.error(message);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="size-4" />
              Supporting documents
            </CardTitle>
            <CardDescription>
              Attach the supplier&apos;s PDF invoice, bill of lading, packing
              slip, or photos of the shipment. Max 25 MB per file.
            </CardDescription>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={!canUpload || isUploading}
            />
            <Button
              type="button"
              size="sm"
              onClick={handlePickFile}
              disabled={!canUpload || isUploading}
              title={!canUpload ? uploadDisabledReason : undefined}
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
                {canUpload
                  ? "Use Upload to attach supporting documents."
                  : "Documents will appear here when attached."}
              </div>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {attachments.map(attachment => {
                const file = attachment.file;
                const href = `/api/supplier-invoices/${supplierInvoiceId}/attachments/${file.id}`;
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
                          {uploader ? ` · uploaded by ${uploader}` : ""}
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
                        onClick={() => confirmRemove(attachment)}
                        disabled={!canRemove || isRemoving}
                        title={!canRemove ? removeDisabledReason : undefined}
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
              from the invoice. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving}
              onClick={event => {
                event.preventDefault();
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
