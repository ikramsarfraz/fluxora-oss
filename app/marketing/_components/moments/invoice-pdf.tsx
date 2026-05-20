"use client";

import { motion } from "motion/react";
import {
  Check,
  Mail,
  PackageCheck,
  Printer,
  Save,
  Send,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";

import { MarketingAppShell } from "./app-shell";

// Full Invoice page with branded PDF preview.
export function InvoicePdfMoment() {
  return (
    <MarketingAppShell
      activeNav="invoices"
      crumbs={["Invoices", "INV-2847"]}
      label="Invoice · branded"
      tone="success"
      rightSlot={
        <>
          <button
            disabled
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-card-warm px-2.5 py-1 text-[11.5px] text-ink-warm"
          >
            <Save className="size-3" strokeWidth={2} />
            Save draft
          </button>
          <motion.button
            disabled
            animate={{ scale: [1, 0.96, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 4 }}
            className="inline-flex items-center gap-1.5 rounded-md bg-forest-mid px-2.5 py-1 text-[11.5px] font-medium text-card-warm"
          >
            <Send className="size-3" strokeWidth={2} />
            Send invoice
          </motion.button>
        </>
      }
    >
      <div className="grid h-full grid-cols-[1.1fr_1fr] gap-0">
        {/* LEFT: order summary + send timeline */}
        <div className="border-r border-border-default p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Posted · May 19, 2026
              </p>
              <h2 className="mt-1 font-serif text-[20px] font-medium tracking-tight text-ink">
                Order SO-2847 · Anchor Tavern
              </h2>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 320, damping: 18 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-[11.5px] font-medium text-success-fg"
            >
              <Check className="size-3" strokeWidth={2.6} />
              Posted
            </motion.div>
          </div>

          {/* Summary table */}
          <div className="mt-4 overflow-hidden rounded-lg border border-border-default bg-card-warm">
            <table className="w-full text-[12px]">
              <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Line</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border-default">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">Atlantic salmon</div>
                    <div className="font-mono text-[10px] text-subtle">L-1245·18 + L-1259·14</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">32 lb</td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-ink">$368.00</td>
                </tr>
                <tr className="border-t border-border-default">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">Wagyu ribeye · 8 oz</div>
                    <div className="font-mono text-[10px] text-subtle">L-1198·6 + L-1233·8</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">14 ea</td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-ink">$448.00</td>
                </tr>
                <tr className="border-t border-border-default">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">Heirloom tomatoes · case</div>
                    <div className="font-mono text-[10px] text-subtle">L-1252·5 + L-1266·3</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">8 case</td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-ink">$304.00</td>
                </tr>
              </tbody>
              <tfoot className="border-t border-border-default bg-surface/40">
                <tr>
                  <td colSpan={2} className="px-3 py-1.5 text-right text-[11.5px] text-subtle">
                    Subtotal
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[11.5px]">$1,120.00</td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-3 py-1.5 text-right text-[11.5px] text-subtle">
                    Tax · 8.75%
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[11.5px]">$98.00</td>
                </tr>
                <tr className="border-t border-border-default">
                  <td colSpan={2} className="px-3 py-2 text-right font-medium text-ink">
                    Total due
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-serif text-[15px] font-medium text-ink">
                      $1,218.00
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-success-border/60 bg-success-bg/40 px-2.5 py-1.5 text-[11px] font-medium text-success-fg"
          >
            <PackageCheck className="size-3" strokeWidth={2} />
            Pick list ready · 6 lots · 3 SKUs
          </motion.div>

          {/* Email composer chip */}
          <div className="mt-4 overflow-hidden rounded-lg border border-border-default bg-card-warm">
            <div className="border-b border-border-default px-3 py-2 text-[11.5px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                To
              </span>
              <span className="ml-2 text-ink">mateo@anchortavern.com</span>
            </div>
            <div className="border-b border-border-default px-3 py-2 text-[11.5px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Subject
              </span>
              <span className="ml-2 text-ink">INV-2847 from Pacific Wharf Provisions</span>
            </div>
            <div className="px-3 py-2 text-[10px] text-subtle">
              Hi Mateo, thanks for your Tuesday order — invoice INV-2847 attached…
            </div>
            <div className="flex items-center gap-2 border-t border-border-default bg-surface/30 px-3 py-2">
              <Mail className="size-3 text-success-fg" strokeWidth={2} />
              <span className="font-mono text-[10px] text-ink-warm">
                INV-2847.pdf · 84 KB · signed
              </span>
              <span className="ml-auto font-mono text-[10px] text-success-fg">
                queued → delivered → opened
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: PDF preview — the focal animation */}
        <aside className="flex flex-col items-center justify-center bg-card-warm/30 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
            Generated PDF · auto-branded
          </div>
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-3 aspect-[0.78] w-[300px] overflow-hidden rounded-md border border-border-default bg-white shadow-[0_22px_50px_-25px_rgba(31,58,46,0.45)]"
          >
            <PdfPreview />

            {/* Sent stamp */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: -6 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 18,
                delay: 1.1,
              }}
              className="absolute right-4 top-1/2 inline-flex items-center gap-1.5 rounded-md border-2 border-success-fg bg-success-bg/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-success-fg"
            >
              <Check className="size-2.5" strokeWidth={2.6} />
              Sent · 4s
            </motion.div>
          </motion.div>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border-default bg-card-warm px-2.5 py-1 text-[11px] text-ink-warm">
            <Printer className="size-3" strokeWidth={2} />
            Letterhead applied · forest accent
          </div>
        </aside>
      </div>
    </MarketingAppShell>
  );
}

function PdfPreview() {
  return (
    <div className="flex h-full flex-col p-5 text-[10px] text-[#1A1A14]">
      <div className="flex items-start justify-between border-b border-[#DDD3B8] pb-3">
        <div className="flex items-center gap-2">
          <Logomark size={26} />
          <div>
            <div className="font-serif text-[14px] font-medium leading-none text-[#1F3A2E]">
              Pacific Wharf Provisions
            </div>
            <div className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#6B6451]">
              Fresh seafood &amp; specialty foods
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#6B6451]">
            Invoice
          </div>
          <div className="font-mono text-[11px] font-medium">INV-2847</div>
          <div className="mt-0.5 font-mono text-[7.5px] text-[#6B6451]">
            May 19, 2026
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-[8.5px]">
        <div>
          <div className="font-mono uppercase tracking-[0.12em] text-[#6B6451]">
            Bill to
          </div>
          <div className="mt-1 font-medium">Anchor Tavern</div>
          <div>Tiburon, CA · Net 7</div>
        </div>
        <div className="text-right">
          <div className="font-mono uppercase tracking-[0.12em] text-[#6B6451]">
            Due
          </div>
          <div>May 26, 2026</div>
        </div>
      </div>

      <table className="mt-3 w-full border-t border-[#DDD3B8] text-[8.5px]">
        <tbody>
          <PdfLine name="Atlantic salmon" qty={32} total={368} />
          <PdfLine name="Wagyu ribeye" qty={14} total={448} />
          <PdfLine name="Heirloom tomatoes" qty={8} total={304} />
        </tbody>
      </table>

      <div className="mt-auto border-t border-[#DDD3B8] pt-2">
        <div className="flex items-baseline justify-end gap-3">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#6B6451]">
            Total due
          </span>
          <span className="font-serif text-[15px] font-medium leading-none text-[#1F3A2E]">
            $1,218.00
          </span>
        </div>
      </div>
    </div>
  );
}

function PdfLine({
  name,
  qty,
  total,
}: {
  name: string;
  qty: number;
  total: number;
}) {
  return (
    <tr className="border-t border-[#EFECD9]">
      <td className="py-1 pr-2 text-[#1A1A14]">{name}</td>
      <td className="py-1 text-right font-mono text-[#3A3528]">{qty}</td>
      <td className="py-1 text-right font-mono text-[#1A1A14]">${total}.00</td>
    </tr>
  );
}
