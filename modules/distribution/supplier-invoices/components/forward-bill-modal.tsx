"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { forwardBillAction } from "../actions/forward-bill";
import { checkBillPdfAvailability } from "../actions/check-bill-pdf-availability";

const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  warn: "var(--color-warning-fg)",
  warnSoft: "var(--color-warning-bg)",
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
  // null = not yet probed, false = no source PDF found, true = PDF available.
  // Determines whether the "Original PDF" checkbox is interactive — bills
  // posted via the single-upload parse flow or typed in directly have no
  // source PDF stored anywhere, so we disable the affordance to set
  // expectations before send.
  const [pdfAvailable, setPdfAvailable] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    checkBillPdfAvailability(invoice.id)
      .then(r => {
        if (cancelled) return;
        setPdfAvailable(r.available);
        // Default the checkbox to OFF when nothing's available, so a
        // distracted user clicking "Send" doesn't expect a PDF that
        // isn't coming.
        if (!r.available) setAttachOriginal(false);
      })
      .catch(() => {
        // Soft-fail: leave pdfAvailable=null. The action still
        // double-checks and will throw a clear error if the user sends
        // with attachedOriginal=true and no PDF.
        if (!cancelled) setPdfAvailable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, invoice.id]);

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
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: pdfAvailable === false ? "not-allowed" : "pointer",
                opacity: pdfAvailable === false ? 0.5 : 1,
              }}
              title={
                pdfAvailable === false
                  ? "This bill has no source PDF on file (posted from typed-in entry or single-upload parse, which doesn't retain the PDF)."
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={attachOriginal && pdfAvailable !== false}
                onChange={e => setAttachOriginal(e.target.checked)}
                disabled={pdfAvailable === false}
              />
              <span style={{ color: C.ink2 }}>
                Original PDF
                {pdfAvailable === false ? (
                  <span style={{ color: C.muted, fontSize: 12 }}> (no PDF on file)</span>
                ) : null}
              </span>
            </label>
            {/* Branded summary attachment is intentionally disabled until a
                supplier-invoice PDF renderer exists (the customer side has
                one in lib/invoices/sales-invoice-pdf; the supplier side
                doesn't). Showing the disabled checkbox keeps the affordance
                visible so the feature is discoverable when it lands. */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "not-allowed",
                opacity: 0.5,
              }}
              title="Coming soon — no branded supplier-invoice PDF render yet."
            >
              <input
                type="checkbox"
                checked={attachSummary}
                onChange={e => setAttachSummary(e.target.checked)}
                disabled
              />
              <span style={{ color: C.ink2 }}>
                Branded summary{" "}
                <span style={{ color: C.muted, fontSize: 12 }}>(coming soon)</span>
              </span>
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
              className="h-8 bg-forest-mid px-4 text-[13px] text-white hover:bg-forest"
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
  color: "var(--color-ink)",
  background: "var(--color-card)",
  outline: "none",
  boxSizing: "border-box",
};

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
