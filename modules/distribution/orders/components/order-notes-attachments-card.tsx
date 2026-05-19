"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { InlineEditTextarea } from "@/components/inline-edit-textarea";
import {
  useUpdateSalesOrderNotes,
  useUploadSalesOrderAttachment,
  useRemoveSalesOrderAttachment,
} from "../hooks/use-orders";
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

import type { SalesOrderDetail } from "../services/orders";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  accent: "var(--color-forest-mid)",
  radius: "10px",
  radiusSm: "6px",
} as const;

type Attachment = SalesOrderDetail["attachments"][number];

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(sizeBytes: number | null | undefined): string {
  if (sizeBytes == null) return "—";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface OrderNotesAttachmentsCardProps {
  order: SalesOrderDetail;
}

export function OrderNotesAttachmentsCard({ order }: OrderNotesAttachmentsCardProps) {
  const updateNotes = useUpdateSalesOrderNotes();
  const uploadMutation = useUploadSalesOrderAttachment(order.id);
  const removeMutation = useRemoveSalesOrderAttachment(order.id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRemove, setPendingRemove] = useState<Attachment | null>(null);

  const attachments = order.attachments ?? [];
  const disabled = order.status === "cancelled";

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
      toast.error(err instanceof Error ? err.message : "Failed to upload attachment.");
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
      toast.error(err instanceof Error ? err.message : "Failed to remove attachment.");
    }
  }

  return (
    <>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: C.radius,
        }}
      >
        {/* Notes: two-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          {/* Customer note */}
          <div style={{ padding: "16px 20px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: C.muted,
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Customer note
            </div>
            <InlineEditTextarea
              value={order.customerNotes}
              placeholder="Visible on invoice"
              emptyLabel="None — visible on invoice"
              disabled={disabled}
              isPending={
                updateNotes.isPending &&
                updateNotes.variables?.customerNotes !== undefined
              }
              onSave={next =>
                updateNotes.mutateAsync({
                  id: order.id,
                  customerNotes: next,
                })
              }
            />
          </div>

          {/* Internal note */}
          <div
            style={{
              padding: "16px 20px",
              borderLeft: `1px solid ${C.line2}`,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: C.muted,
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Internal note
            </div>
            <InlineEditTextarea
              value={order.internalNotes}
              placeholder="Staff only"
              emptyLabel="None — staff only"
              disabled={disabled}
              isPending={
                updateNotes.isPending &&
                updateNotes.variables?.internalNotes !== undefined
              }
              onSave={next =>
                updateNotes.mutateAsync({
                  id: order.id,
                  internalNotes: next,
                })
              }
            />
          </div>
        </div>

        {/* Attachments strip */}
        <div style={{ borderTop: `1px solid ${C.line2}` }}>
          {/* Upload row */}
          <div
            style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: C.muted,
              fontSize: "13px",
            }}
          >
            {/* Paperclip icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ flexShrink: 0 }}
            >
              <path d="M11 4l-5 5a2 2 0 1 0 3 3l6-6a3.5 3.5 0 0 0-5-5L4 7a5 5 0 1 0 7 7" />
            </svg>

            <span>
              {attachments.length === 0
                ? "No attachments"
                : `${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`}
            </span>

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="ml-auto border-border-default bg-card text-xs text-ink shadow-none hover:bg-divider disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>

          {/* Attachment list */}
          {attachments.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {attachments.map(attachment => {
                const file = attachment.file;
                const href = `/api/sales-orders/${order.id}/attachments/${file.id}`;
                const uploader =
                  file.uploadedByUser?.fullName ?? file.uploadedByUser?.email ?? null;

                return (
                  <li
                    key={file.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 20px",
                      borderTop: `1px solid ${C.line2}`,
                      fontSize: "13px",
                    }}
                  >
                    {/* File icon */}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      style={{ flexShrink: 0, color: C.muted }}
                    >
                      <rect x="3" y="2" width="10" height="12" rx="1" />
                      <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" />
                    </svg>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          color: C.ink,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {file.originalFilename ?? "attachment"}
                      </div>
                      <div style={{ fontSize: "11px", color: C.muted }}>
                        {formatSize(file.sizeBytes)}
                        {file.mimeType ? ` · ${file.mimeType}` : ""}
                        {uploader ? ` · ${uploader}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "12px",
                          color: C.accent,
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        Open
                      </a>
                      <span style={{ color: C.line }}>·</span>
                      <a
                        href={`${href}?download=1`}
                        style={{
                          fontSize: "12px",
                          color: C.accent,
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        Download
                      </a>
                      <span style={{ color: C.line }}>·</span>
                      <Button
                        type="button"
                        onClick={() => setPendingRemove(attachment)}
                        disabled={removeMutation.isPending}
                        variant="link"
                        className="h-auto p-0 text-xs text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Remove attachment confirmation */}
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
              <strong>{pendingRemove?.file.originalFilename ?? "this file"}</strong> from the
              order. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMutation.isPending}
              onClick={e => {
                e.preventDefault();
                void handleRemove();
              }}
            >
              {removeMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
