"use client";

import { motion } from "motion/react";
import { Check, Mail, Send } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";

import { MomentFrame } from "./moment-frame";

// A clean, branded invoice mock — sized for marketing legibility, not the
// real PDF densities. Plus a small "sent" badge sliding in.
export function InvoicePdfMoment() {
  return (
    <MomentFrame label="Invoice PDF" tone="success">
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.2fr_1fr]">
        {/* PDF preview */}
        <div className="relative bg-white p-6">
          <div className="flex items-start justify-between border-b border-[#DDD3B8] pb-3">
            <div className="flex items-center gap-2">
              <Logomark size={28} />
              <div>
                <div className="font-serif text-[16px] font-medium leading-none text-[#1F3A2E]">
                  Pacific Wharf Provisions
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B6451]">
                  Fresh seafood &amp; specialty foods
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B6451]">
                Invoice
              </div>
              <div className="font-mono text-[12px] font-medium text-[#1A1A14]">
                INV-2847
              </div>
              <div className="mt-0.5 font-mono text-[9px] text-[#6B6451]">
                May 19, 2026
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#6B6451]">
                Bill to
              </div>
              <div className="mt-1 font-medium text-[#1A1A14]">
                Anchor Tavern
              </div>
              <div className="text-[#3A3528]">Tiburon, CA</div>
              <div className="font-mono text-[8.5px] text-[#6B6451]">
                Terms: Net 7
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#6B6451]">
                Due
              </div>
              <div className="text-[#3A3528]">May 26, 2026</div>
            </div>
          </div>

          <table className="mt-3 w-full border-t border-[#DDD3B8] text-[10px]">
            <tbody>
              <PdfLine name="Atlantic salmon · 4 lb" qty={32} price={11.5} />
              <PdfLine name="Wagyu ribeye · 8 oz" qty={14} price={32.0} />
              <PdfLine name="Heirloom tomatoes · case" qty={8} price={38.0} />
            </tbody>
          </table>

          <div className="mt-3 border-t border-[#DDD3B8] pt-2">
            <div className="flex items-baseline justify-end gap-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B6451]">
                Total due
              </span>
              <span className="font-serif text-[18px] font-medium leading-none text-[#1F3A2E]">
                $1,316.93
              </span>
            </div>
          </div>

          {/* Sent stamp */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: -6 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
              delay: 0.6,
            }}
            className="absolute right-5 top-1/2 inline-flex items-center gap-1.5 rounded-md border-2 border-success-fg bg-success-bg/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-success-fg"
          >
            <Check className="size-3" strokeWidth={2.6} />
            Sent · 4s
          </motion.div>
        </div>

        {/* Right rail: send action + delivery */}
        <div className="border-t border-border-default bg-card-warm/40 p-6 md:border-l md:border-t-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            One click sends
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-md border border-border-default bg-card-warm px-3 py-2 text-[12px]">
            <Mail className="size-3.5 text-subtle" strokeWidth={2} />
            <span className="text-ink">mateo@anchortavern.com</span>
          </div>

          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-forest-mid px-3 py-2 text-[12px] font-medium text-card-warm"
          >
            <Send className="size-3" strokeWidth={2.2} />
            Send invoice
          </motion.div>

          <ul className="mt-5 space-y-2 text-[11.5px] text-ink-warm">
            <Track label="Queued" time="9:12:01" delay={0.7} />
            <Track label="Delivered" time="9:12:05" delay={1.0} />
            <Track label="Opened" time="9:12:48" delay={1.3} />
          </ul>
        </div>
      </div>
    </MomentFrame>
  );
}

function PdfLine({
  name,
  qty,
  price,
}: {
  name: string;
  qty: number;
  price: number;
}) {
  return (
    <tr className="border-t border-[#EFECD9]">
      <td className="py-1 pr-2 text-[#1A1A14]">{name}</td>
      <td className="py-1 text-right font-mono text-[#3A3528]">{qty}</td>
      <td className="py-1 text-right font-mono text-[#3A3528]">
        ${price.toFixed(2)}
      </td>
      <td className="py-1 text-right font-mono text-[#1A1A14]">
        ${(qty * price).toFixed(2)}
      </td>
    </tr>
  );
}

function Track({
  label,
  time,
  delay,
}: {
  label: string;
  time: string;
  delay: number;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2"
    >
      <div className="flex size-5 items-center justify-center rounded-full bg-success-bg text-success-fg">
        <Check className="size-3" strokeWidth={2.6} />
      </div>
      <span className="text-ink">{label}</span>
      <span className="ml-auto font-mono text-[10px] text-subtle">
        {time} AM
      </span>
    </motion.li>
  );
}
