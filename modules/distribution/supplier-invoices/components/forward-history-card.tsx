"use client";

import { Card } from "@/components/ui/card";
import { Paperclip } from "lucide-react";

const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  radius: "10px",
} as const;

type BillForward = {
  id: string;
  recipients: unknown;
  subject: string;
  attachedOriginal: boolean;
  attachedSummary: boolean;
  deliveryStatus: string;
  sentAt: Date | string;
  sentBy?: {
    fullName: string | null;
    email: string | null;
  } | null;
};

export function ForwardHistoryCard({ forwards }: { forwards: BillForward[] }) {
  if (forwards.length === 0) return null;

  return (
    <Card className="gap-0 overflow-hidden rounded-[10px] border-stone-line bg-stone-surface py-0 shadow-none ring-0">
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Forward history</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          Emails sent from this bill.
        </div>
      </div>
      <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 1 }}>
        {forwards.map(fwd => {
          const recipients = Array.isArray(fwd.recipients)
            ? (fwd.recipients as string[]).join(", ")
            : String(fwd.recipients);
          const sentDate = new Date(fwd.sentAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const sender = fwd.sentBy?.fullName ?? fwd.sentBy?.email ?? "Unknown";
          const attachments = [
            fwd.attachedOriginal && "Original PDF",
            fwd.attachedSummary && "Branded summary",
          ].filter(Boolean).join(", ");

          return (
            <div
              key={fwd.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 0",
                borderBottom: `1px solid ${C.line2}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {recipients}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                  {fwd.subject}
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
                by {sender}
              </div>
              {attachments && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted }}>
                  <Paperclip size={10} />
                  {attachments}
                </div>
              )}
              <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
                {sentDate}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
