"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, FileText, Mail, Paperclip, Send } from "lucide-react";

import { cn } from "@/lib/utils";

import { CUSTOMER, INVOICE, TENANT, TOTAL } from "../_data/invoice";
import { FakeAppShell } from "./fake-app-shell";

// Scene 3: compose email, attach the PDF, send. Status track from
// "queued" → "delivered" → "opened" on a small timeline.

type Stage = "compose" | "sending" | "sent" | "delivered";
const STAGE_ORDER: Stage[] = ["compose", "sending", "sent", "delivered"];
const STAGE_MS: Record<Stage, number> = {
  compose: 2200,
  sending: 1100,
  sent: 1400,
  delivered: 2500,
};

const EMAIL_BODY = `Hi ${CUSTOMER.attn},\n\nThanks for your Tuesday order — invoice ${INVOICE.number} is attached. Total $${TOTAL.toFixed(2)}, due ${INVOICE.dueDate} on your usual ${CUSTOMER.terms} terms.\n\nAppreciate the partnership.\n\nSarah\nPacific Wharf Provisions`;

export function SendScene() {
  const [stage, setStage] = useState<Stage>("compose");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      acc += STAGE_MS[STAGE_ORDER[i]];
      const next = STAGE_ORDER[i + 1];
      timers.push(setTimeout(() => setStage(next), acc));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const sent = stage === "sent" || stage === "delivered";

  return (
    <motion.div
      key="send-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Invoices", INVOICE.number, "Send"]}>
        <div className="grid h-full grid-cols-[1.2fr_1fr] gap-0">
          {/* Email composer */}
          <div className="overflow-y-auto p-6">
            <header>
              <h1 className="font-serif text-[22px] font-medium tracking-tight text-ink">
                Send invoice
              </h1>
              <p className="mt-1 text-[12px] text-subtle">
                Your draft. Edit anything before it goes out.
              </p>
            </header>

            <div className="mt-5 overflow-hidden rounded-lg border border-border-default bg-card-warm">
              <div className="border-b border-border-default px-4 py-2">
                <Field label="To" value={`mateo@anchortavern.com`} />
              </div>
              <div className="border-b border-border-default px-4 py-2">
                <Field
                  label="Subject"
                  value={`${INVOICE.number} from ${TENANT.name}`}
                />
              </div>
              <div className="px-4 py-3 text-[12.5px] leading-[1.55] text-ink whitespace-pre-wrap">
                {EMAIL_BODY}
              </div>
              <div className="flex items-center gap-2 border-t border-border-default bg-surface/30 px-4 py-2.5">
                <div className="flex items-center gap-1.5 rounded-md border border-border-default bg-card-warm px-2 py-1 text-[11px]">
                  <Paperclip className="size-3 text-subtle" strokeWidth={2} />
                  <FileText className="size-3 text-forest-mid" strokeWidth={2} />
                  <span className="font-mono text-[10.5px] text-ink-warm">
                    {INVOICE.number}.pdf · 84 KB
                  </span>
                </div>
                <span className="ml-auto font-mono text-[10px] text-subtle">
                  signed · branded
                </span>
              </div>
            </div>

            {/* Send button */}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px] text-ink-warm"
                disabled
              >
                Save draft
              </button>
              <motion.button
                animate={
                  stage === "sending" ? { scale: [1, 0.94, 1] } : {}
                }
                transition={{ duration: 0.4 }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium",
                  sent
                    ? "bg-success-fg text-card-warm"
                    : "bg-forest-mid text-card-warm",
                )}
                disabled
              >
                {sent ? (
                  <>
                    <Check className="size-3.5" strokeWidth={2.4} />
                    Sent
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" strokeWidth={2.2} />
                    Send now
                  </>
                )}
              </motion.button>
            </div>

            {/* Status timeline */}
            <AnimatePresence>
              {sent ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-lg border border-border-default bg-card-warm p-4"
                >
                  <div className="flex items-center gap-2">
                    <Mail
                      className="size-3.5 text-forest-mid"
                      strokeWidth={2}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                      Delivery
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    <Track
                      label="Queued"
                      time="9:12:01 AM"
                      done
                    />
                    <Track
                      label="Delivered to inbox"
                      time="9:12:05 AM"
                      done
                    />
                    <Track
                      label="Opened by Anchor Tavern"
                      time={
                        stage === "delivered" ? "9:12:48 AM" : "—"
                      }
                      done={stage === "delivered"}
                    />
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* PDF thumb on the right */}
          <aside className="flex flex-col items-center justify-center bg-card-warm/30 p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Attached
            </div>
            <motion.div
              animate={sent ? { y: -6 } : { y: 0 }}
              transition={{ duration: 0.45 }}
              className="mt-3 aspect-[0.78] w-[260px] overflow-hidden rounded-md border border-border-default bg-white shadow-md"
            >
              <div className="flex h-full flex-col p-4 text-[7px]">
                <div className="flex justify-between border-b pb-1.5">
                  <span
                    className="font-serif text-[10px] font-medium"
                    style={{ color: TENANT.primaryHex }}
                  >
                    {TENANT.name}
                  </span>
                  <span className="font-mono text-[7px]">{INVOICE.number}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="h-1 w-3/4 rounded bg-[#EFECD9]" />
                  <div className="h-1 w-1/2 rounded bg-[#EFECD9]" />
                </div>
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 rounded bg-[#EFECD9]" />
                  <div className="h-1.5 rounded bg-[#EFECD9]" />
                  <div className="h-1.5 rounded bg-[#EFECD9]" />
                </div>
                <div
                  className="mt-auto border-t pt-1 text-right font-serif text-[8px] font-medium"
                  style={{ color: TENANT.primaryHex }}
                >
                  Total · ${TOTAL.toFixed(2)}
                </div>
              </div>
            </motion.div>
            <span className="mt-3 font-mono text-[10.5px] text-subtle">
              {INVOICE.number}.pdf · 84 KB · signed
            </span>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px]">
      <span className="w-[60px] font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </span>
      <span className="flex-1 text-ink">{value}</span>
    </div>
  );
}

function Track({
  label,
  time,
  done,
}: {
  label: string;
  time: string;
  done: boolean;
}) {
  return (
    <li className="flex items-center gap-3 text-[12px]">
      <div
        className={cn(
          "flex size-5 items-center justify-center rounded-full",
          done ? "bg-success-bg text-success-fg" : "bg-surface text-subtle",
        )}
      >
        {done ? <Check className="size-3" strokeWidth={2.6} /> : null}
      </div>
      <span className={cn(done ? "text-ink" : "text-subtle")}>{label}</span>
      <span className="ml-auto font-mono text-[10px] text-subtle">{time}</span>
    </li>
  );
}
