"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { forwardBillAction } from "../actions/forward-bill";

const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  warn: "oklch(70% 0.13 70)",
  warnSoft: "oklch(97% 0.04 70)",
  radius: "10px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: string | number;
  supplierName: string | null;
  status: string;
  paidAt: string | null;
};

export function ForwardBillModal({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}) {
  const router = useRouter();
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [invalidEmails, setInvalidEmails] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(buildDefaultSubject(invoice));
  const [body, setBody] = useState(buildDefaultBody(invoice));
  const [attachOriginal, setAttachOriginal] = useState(true);
  const [attachSummary, setAttachSummary] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const addRecipients = (raw: string) => {
    const parts = raw
      .split(/[,;\n\t]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const newEmails: string[] = [];
    const newInvalid = new Set(invalidEmails);
    for (const email of parts) {
      if (recipients.includes(email)) continue;
      if (recipients.length + newEmails.length >= 10) break;
      newEmails.push(email);
      if (!isValidEmail(email)) {
        newInvalid.add(email);
      }
    }
    setRecipients(prev => [...prev, ...newEmails]);
    setInvalidEmails(newInvalid);
    setRecipientInput("");
  };

  const removeRecipient = (email: string) => {
    setRecipients(prev => prev.filter(e => e !== email));
    setInvalidEmails(prev => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      if (recipientInput.trim()) addRecipients(recipientInput);
    }
    if (e.key === "Backspace" && !recipientInput && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text.includes(",") || text.includes(";") || text.includes("\n")) {
      e.preventDefault();
      addRecipients(text);
    }
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error("Add at least one recipient.");
      return;
    }
    if (invalidEmails.size > 0) {
      toast.error("Fix invalid email addresses before sending.");
      return;
    }
    setSending(true);
    try {
      await forwardBillAction({
        supplierInvoiceId: invoice.id,
        recipients,
        subject,
        messageBody: body,
        attachedOriginal: attachOriginal,
        attachedSummary: attachSummary,
      });
      toast.success("Bill forwarded.");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 50,
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 51,
          width: "min(560px, 95vw)",
          background: C.surface,
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          fontFamily: "'Geist', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
            Forward bill
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Attachment card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: C.line2,
              borderRadius: 8,
            }}
          >
            <Paperclip size={14} color={C.muted} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
                {invoice.invoiceNumber}.pdf
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {invoice.supplierName ?? "Supplier invoice"} · original attachment
              </div>
            </div>
          </div>

          {/* Recipients */}
          <FormRow label="To">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                padding: "6px 10px",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                cursor: "text",
                minHeight: 38,
                alignItems: "center",
              }}
              onClick={() => inputRef.current?.focus()}
            >
              {recipients.map(email => (
                <div
                  key={email}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 100,
                    fontSize: 12,
                    background: invalidEmails.has(email) ? C.warnSoft : C.line2,
                    border: `1px solid ${invalidEmails.has(email) ? C.warn : C.line}`,
                    color: invalidEmails.has(email) ? C.warn : C.ink2,
                  }}
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(email)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit" }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {recipients.length < 10 && (
                <input
                  ref={inputRef}
                  type="text"
                  value={recipientInput}
                  onChange={e => setRecipientInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => { if (recipientInput.trim()) addRecipients(recipientInput); }}
                  onPaste={handlePaste}
                  placeholder={recipients.length === 0 ? "Email addresses, separated by comma" : ""}
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    color: C.ink,
                    background: "transparent",
                    flex: "1 1 120px",
                    minWidth: 120,
                  }}
                />
              )}
            </div>
          </FormRow>

          {/* Subject */}
          <FormRow label="Subject">
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={inputStyle}
            />
          </FormRow>

          {/* Message */}
          <FormRow label="Message">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: "vertical", height: "auto" }}
            />
          </FormRow>

          {/* Attachments + from-line */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Attachments
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={attachOriginal}
                onChange={e => setAttachOriginal(e.target.checked)}
              />
              <span style={{ color: C.ink2 }}>Original PDF</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={attachSummary}
                onChange={e => setAttachSummary(e.target.checked)}
              />
              <span style={{ color: C.ink2 }}>Branded summary (generated on send)</span>
            </label>
          </div>

          <div style={{ fontSize: 11, color: C.muted }}>
            Sent via {process.env.NEXT_PUBLIC_FROM_ADDRESS ?? "billing@example.com"} · replies go to your address
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <span style={{ fontSize: 11, color: C.muted }}>Logged on bill detail page</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-4 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={sending || recipients.length === 0 || invalidEmails.size > 0}
              className="h-8 bg-stone-ink px-4 text-[13px] text-white hover:bg-stone-ink/90"
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: `1px solid #e7e5e4`,
  borderRadius: 8,
  fontSize: 13,
  color: "#0c0a09",
  background: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
};

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function buildDefaultSubject(invoice: Invoice): string {
  const date = new Date(invoice.invoiceDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const total = Number(invoice.totalAmount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return `Invoice from ${invoice.supplierName ?? "supplier"} · ${date} · ${total}`;
}

function buildDefaultBody(invoice: Invoice): string {
  const date = new Date(invoice.invoiceDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const paidLine =
    invoice.status === "paid" && invoice.paidAt
      ? `\nPaid in full via ACH on ${new Date(invoice.paidAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}.`
      : "";

  return `Hi,\n\nAttaching the ${date} invoice from ${invoice.supplierName ?? "the supplier"} for your records.${paidLine}\n\nThanks`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
