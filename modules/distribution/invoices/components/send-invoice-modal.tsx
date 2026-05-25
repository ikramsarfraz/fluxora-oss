"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendInvoiceToCustomerAction } from "../actions/send-invoice";
import { checkInvoiceSendPreview } from "../actions/check-invoice-send-preview";

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
  dueDate: string | null;
  totalAmount: string | number;
  balanceDue: string | number;
  customerName: string | null;
  status: string;
};

/**
 * Customer-facing "Send invoice" modal — AR counterpart to
 * ForwardBillModal. Three things differ from the AP shape:
 *
 *   1. The PDF isn't picked from a list — it's *rendered* on the fly by
 *      sendInvoiceToCustomerAction, so we just toggle "attach PDF" as a
 *      single boolean rather than a per-file checklist.
 *   2. The default recipient comes from the customer record (saved
 *      billing email), pre-filled from checkInvoiceSendPreview.
 *   3. CC field exists — common for accounting to copy themselves on
 *      every customer-facing send.
 *
 * The submit button reads "Send" first time, "Resend" on subsequent
 * sends, computed from the prior send_count returned by the preview.
 */
export function SendInvoiceModal({
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
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [invalidEmails, setInvalidEmails] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(buildDefaultSubject(invoice));
  const [body, setBody] = useState(buildDefaultBody(invoice));
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);
  // Server-resolved preview: customer's default email, From envelope,
  // and prior-send state. Null while loading.
  const [defaultRecipient, setDefaultRecipient] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  const [fromDisplayName, setFromDisplayName] = useState<string | null>(null);
  const [replyToEmail, setReplyToEmail] = useState<string | null>(null);
  const [sendCount, setSendCount] = useState<number>(0);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    checkInvoiceSendPreview(invoice.id)
      .then(r => {
        if (cancelled) return;
        setDefaultRecipient(r.defaultRecipient);
        setFromEmail(r.fromEmail);
        setFromDisplayName(r.fromDisplayName);
        setReplyToEmail(r.replyToEmail);
        setSendCount(r.sendCount);
        setLastSentAt(r.lastSentAt);
        // Pre-fill the recipient input with the customer's saved email
        // — but only on first open (when recipients is still empty).
        // Lets the user just hit Send for the common case while still
        // letting them edit before submit.
        if (r.defaultRecipient && recipients.length === 0) {
          setRecipients([r.defaultRecipient]);
        }
      })
      .catch(() => {
        // Soft-fail: leave defaults empty. The action still re-checks
        // server-side and surfaces a clean error if needed.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.id]);

  if (!open) return null;

  const addRecipients = (raw: string, target: "to" | "cc") => {
    const list = target === "to" ? recipients : ccRecipients;
    const totalSoFar = recipients.length + ccRecipients.length;
    const parts = raw
      .split(/[,;\n\t]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const newEmails: string[] = [];
    const newInvalid = new Set(invalidEmails);
    for (const email of parts) {
      if (list.includes(email)) continue;
      if (totalSoFar + newEmails.length >= 10) break;
      newEmails.push(email);
      if (!isValidEmail(email)) {
        newInvalid.add(email);
      }
    }
    if (target === "to") {
      setRecipients(prev => [...prev, ...newEmails]);
      setRecipientInput("");
    } else {
      setCcRecipients(prev => [...prev, ...newEmails]);
      setCcInput("");
    }
    setInvalidEmails(newInvalid);
  };

  const removeRecipient = (email: string, target: "to" | "cc") => {
    if (target === "to") {
      setRecipients(prev => prev.filter(e => e !== email));
    } else {
      setCcRecipients(prev => prev.filter(e => e !== email));
    }
    setInvalidEmails(prev => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  };

  const makeKeyDown = (
    target: "to" | "cc",
    value: string,
    list: string[],
  ) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      if (value.trim()) addRecipients(value, target);
    }
    if (e.key === "Backspace" && !value && list.length > 0) {
      removeRecipient(list[list.length - 1], target);
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
      const result = await sendInvoiceToCustomerAction({
        salesInvoiceId: invoice.id,
        recipients,
        ccRecipients,
        subject,
        messageBody: body,
        attachPdf,
      });
      toast.success(
        result.statusFlipped
          ? "Invoice sent. Marked as sent."
          : "Invoice sent.",
      );
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  const isResend = sendCount > 0;
  const sendLabel = sending
    ? "Sending…"
    : isResend
      ? `Resend${sendCount >= 1 ? ` (${ordinal(sendCount + 1)} send)` : ""}`
      : "Send";

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
            {isResend ? "Resend invoice" : "Send invoice to customer"}
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
          {/* Attachment card — single rendered PDF, not a picker */}
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
            <FileText size={14} color={C.muted} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
                {invoice.invoiceNumber}.pdf
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {invoice.customerName ?? "Customer invoice"} · rendered on send
              </div>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: attachPdf ? C.ink2 : C.muted,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={e => setAttachPdf(e.target.checked)}
              />
              Attach
            </label>
          </div>

          {/* Recipients */}
          <FormRow label="To">
            <ChipInput
              chips={recipients}
              invalid={invalidEmails}
              value={recipientInput}
              setValue={setRecipientInput}
              onAdd={raw => addRecipients(raw, "to")}
              onRemove={email => removeRecipient(email, "to")}
              onKeyDown={makeKeyDown("to", recipientInput, recipients)}
              placeholder={
                recipients.length === 0
                  ? defaultRecipient ?? "customer@example.com"
                  : ""
              }
              disabled={recipients.length + ccRecipients.length >= 10}
              inputRef={inputRef}
            />
          </FormRow>

          {/* CC */}
          <FormRow label="CC (optional)">
            <ChipInput
              chips={ccRecipients}
              invalid={invalidEmails}
              value={ccInput}
              setValue={setCcInput}
              onAdd={raw => addRecipients(raw, "cc")}
              onRemove={email => removeRecipient(email, "cc")}
              onKeyDown={makeKeyDown("cc", ccInput, ccRecipients)}
              placeholder={
                ccRecipients.length === 0 ? "Copy yourself or your team" : ""
              }
              disabled={recipients.length + ccRecipients.length >= 10}
              inputRef={ccInputRef}
            />
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
              rows={6}
              style={{ ...inputStyle, resize: "vertical", height: "auto" }}
            />
          </FormRow>

          {/* Last-sent reminder + from-line */}
          {lastSentAt ? (
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                padding: "6px 10px",
                background: C.line2,
                borderRadius: 6,
              }}
            >
              Last sent {formatRelative(lastSentAt)} ·{" "}
              {sendCount === 1 ? "1 prior send" : `${sendCount} prior sends`}
            </div>
          ) : null}

          <div style={{ fontSize: 11, color: C.muted }}>
            {fromEmail ? (
              <>
                Sent via{" "}
                <span style={{ fontFamily: C.mono }}>{fromEmail}</span>
                {fromDisplayName ? (
                  <>
                    {" "}as <span style={{ color: C.ink2 }}>{fromDisplayName}</span>
                  </>
                ) : null}
                {" · "}
                replies go to{" "}
                <span style={{ fontFamily: C.mono }}>
                  {replyToEmail ?? "your address"}
                </span>
              </>
            ) : (
              "Loading sender info…"
            )}
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
          <span style={{ fontSize: 11, color: C.muted }}>
            {invoice.status === "draft"
              ? "Sending will mark this invoice as sent."
              : "Logged on the invoice's send history."}
          </span>
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
              {sendLabel}
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
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Shared chip-style email input used for both the To and CC fields.
 * Extracted because the AR modal has two of them — duplicating the
 * 40-line markup twice was painful in the AP modal and tempting to
 * diverge subtly.
 */
function ChipInput({
  chips,
  invalid,
  value,
  setValue,
  onAdd,
  onRemove,
  onKeyDown,
  placeholder,
  disabled,
  inputRef,
}: {
  chips: string[];
  invalid: Set<string>;
  value: string;
  setValue: (s: string) => void;
  onAdd: (raw: string) => void;
  onRemove: (email: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  disabled?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        padding: "6px 10px",
        border: `1px solid var(--color-border-default)`,
        borderRadius: 8,
        cursor: "text",
        minHeight: 38,
        alignItems: "center",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map(email => (
        <div
          key={email}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 100,
            fontSize: 12,
            background: invalid.has(email)
              ? "var(--color-warning-bg)"
              : "var(--color-divider)",
            border: `1px solid ${invalid.has(email) ? "var(--color-warning-fg)" : "var(--color-border-default)"}`,
            color: invalid.has(email) ? "var(--color-warning-fg)" : "var(--color-ink-warm)",
          }}
        >
          {email}
          <button
            type="button"
            onClick={() => onRemove(email)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              color: "inherit",
            }}
          >
            <X size={10} />
          </button>
        </div>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (value.trim()) onAdd(value);
          }}
          onPaste={e => {
            const text = e.clipboardData.getData("text");
            if (text.includes(",") || text.includes(";") || text.includes("\n")) {
              e.preventDefault();
              onAdd(text);
            }
          }}
          placeholder={placeholder}
          style={{
            border: "none",
            outline: "none",
            fontSize: 13,
            color: "var(--color-ink)",
            background: "transparent",
            flex: "1 1 120px",
            minWidth: 120,
          }}
        />
      )}
    </div>
  );
}

function buildDefaultSubject(invoice: Invoice): string {
  const due = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const total = Number(invoice.totalAmount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  // Subject line aims for the recipient inbox: invoice number first (so it
  // threads with their own filing) then amount + due date.
  return due
    ? `Invoice ${invoice.invoiceNumber} · ${total} due ${due}`
    : `Invoice ${invoice.invoiceNumber} · ${total}`;
}

function buildDefaultBody(invoice: Invoice): string {
  const due = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const total = Number(invoice.totalAmount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  const balance = Number(invoice.balanceDue);
  const balanceLine =
    balance > 0 && balance < Number(invoice.totalAmount)
      ? `\nCurrent balance: ${balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}.`
      : "";
  const greeting = invoice.customerName
    ? `Hi ${invoice.customerName} team,`
    : "Hi,";

  return `${greeting}\n\nPlease find attached invoice ${invoice.invoiceNumber} for ${total}${due ? `, due ${due}` : ""}.${balanceLine}\n\nLet us know if anything looks off.\n\nThanks`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))} min ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
