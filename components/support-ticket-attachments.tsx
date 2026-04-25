import Link from "next/link";
import { Paperclip } from "lucide-react";

type SupportTicketAttachment = {
  fileId: string;
  file?: {
    originalFilename: string | null;
    sizeBytes: number | null;
  } | null;
};

function formatBytes(value: number | null | undefined) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportTicketAttachments({
  ticketId,
  attachments,
}: {
  ticketId: string;
  attachments: SupportTicketAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Attachments</p>
      <div className="flex flex-wrap gap-2">
        {attachments.map(attachment => {
          const filename =
            attachment.file?.originalFilename ?? "Support attachment";
          return (
            <Link
              key={attachment.fileId}
              href={`/api/support-tickets/${ticketId}/attachments/${attachment.fileId}?download=1`}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              <Paperclip className="size-4" />
              <span>{filename}</span>
              {attachment.file?.sizeBytes ? (
                <span className="text-xs text-muted-foreground">
                  {formatBytes(attachment.file.sizeBytes)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
