"use client";

import { motion, type Variants } from "motion/react";
import { Sigma } from "lucide-react";

import { cn } from "@/lib/utils";

import { DEMO_CUSTOMERS, TOTAL_CUSTOMERS } from "../_data/customers";

// Cinematic Excel-style spreadsheet that opens the reel. The grid stagger-
// fades in row by row, and a blue cell-selection rectangle walks through a
// handful of cells to draw the eye — like someone scrolling through the file
// they've been keeping for years.

const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;
const COLUMN_HEADERS = [
  "Name",
  "Phone",
  "Email",
  "Abbr",
  "City",
  "State",
  "Terms",
] as const;

// Column widths (rough) so the grid feels real.
const COLUMN_WIDTHS = [
  "minmax(180px, 1.8fr)",
  "minmax(120px, 1fr)",
  "minmax(180px, 1.6fr)",
  "minmax(72px, 0.55fr)",
  "minmax(120px, 1fr)",
  "minmax(60px, 0.45fr)",
  "minmax(80px, 0.6fr)",
] as const;

const rowEntry: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const tableContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.25 } },
};

export function SpreadsheetScene() {
  return (
    <motion.div
      key="spreadsheet"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col bg-[#FAFAF6]"
    >
      {/* Excel-style title bar */}
      <div className="flex items-center gap-3 border-b border-[#D7D3C2] bg-[#217346] px-5 py-2">
        <div className="flex size-5 items-center justify-center rounded bg-card-warm font-mono text-[10px] font-bold text-[#217346]">
          X
        </div>
        <span className="font-mono text-[12px] text-card-warm">
          customer-book-2025.xlsx
        </span>
        <span className="text-[11px] text-card-warm/70">— Excel</span>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-card-warm/80">
          <Sigma className="size-3" strokeWidth={2} />
          <span className="font-mono">
            {TOTAL_CUSTOMERS} rows · last saved Tuesday
          </span>
        </div>
      </div>

      {/* Toolbar strip (decorative) */}
      <div className="flex items-center gap-4 border-b border-[#D7D3C2] bg-[#F2F0E8] px-5 py-1.5 text-[11px] text-[#5A5240]">
        <span className="font-medium">File</span>
        <span>Home</span>
        <span>Insert</span>
        <span>Data</span>
        <span>Review</span>
        <span>View</span>
        <span className="ml-auto font-mono text-[10px] text-[#7A7260]">
          B3 ·{" "}
          <span className="text-[#217346]">
            =CONCATENATE(B2, &quot;-&quot;, C2)
          </span>
        </span>
      </div>

      {/* Caption above the grid */}
      <div className="px-5 pt-5 pb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
          Where the customer book lives today
        </p>
      </div>

      {/* Grid area */}
      <div className="relative flex-1 overflow-hidden px-5 pb-5">
        <div
          className="relative h-full overflow-hidden rounded-sm border border-[#C9C2A8] bg-card-warm shadow-sm"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {/* Column-letter header */}
          <div
            className="grid items-center border-b border-[#C9C2A8] bg-[#E8E4D2]"
            style={{
              gridTemplateColumns: `40px ${COLUMN_WIDTHS.join(" ")}`,
            }}
          >
            <div className="border-r border-[#C9C2A8] py-1 text-center font-mono text-[10px] text-[#7A7260]" />
            {COLUMN_LETTERS.map((letter) => (
              <div
                key={letter}
                className="border-r border-[#C9C2A8] py-1 text-center font-mono text-[10px] font-medium text-[#5A5240] last:border-r-0"
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Body */}
          <motion.div
            variants={tableContainer}
            initial="hidden"
            animate="show"
            className="relative"
          >
            {/* Row 1 = column titles (the user's own header row) */}
            <motion.div
              variants={rowEntry}
              className="grid items-stretch border-b border-[#E0DCC6] bg-[#F6F3E6]"
              style={{
                gridTemplateColumns: `40px ${COLUMN_WIDTHS.join(" ")}`,
              }}
            >
              <Cell rowLabel>1</Cell>
              {COLUMN_HEADERS.map((label) => (
                <Cell key={label} bold>
                  {label}
                </Cell>
              ))}
            </motion.div>

            {/* Data rows */}
            {DEMO_CUSTOMERS.map((customer, idx) => (
              <motion.div
                key={customer.name}
                variants={rowEntry}
                className={cn(
                  "grid items-stretch border-b border-[#EFECD9]",
                  idx % 2 === 1 ? "bg-[#FBF8E8]/40" : "",
                )}
                style={{
                  gridTemplateColumns: `40px ${COLUMN_WIDTHS.join(" ")}`,
                }}
              >
                <Cell rowLabel>{idx + 2}</Cell>
                <Cell>{customer.name}</Cell>
                <Cell mono>{customer.phone}</Cell>
                <Cell>{customer.email}</Cell>
                <Cell mono>{customer.abbreviation}</Cell>
                <Cell>{customer.city}</Cell>
                <Cell mono>{customer.state}</Cell>
                <Cell>{customer.terms}</Cell>
              </motion.div>
            ))}
          </motion.div>

          {/* Animated cell-selection cursor */}
          <SelectionCursor />
        </div>

        {/* Bottom sheet tabs (Excel-style) */}
        <div className="absolute bottom-2 left-5 flex items-center gap-1">
          <div className="rounded-t border border-[#C9C2A8] border-b-0 bg-card-warm px-3 py-1 font-mono text-[10px] text-[#217346]">
            customers
          </div>
          <div className="border-x border-[#C9C2A8] bg-[#E8E4D2] px-3 py-1 font-mono text-[10px] text-[#7A7260]">
            products
          </div>
          <div className="border-r border-[#C9C2A8] bg-[#E8E4D2] px-3 py-1 font-mono text-[10px] text-[#7A7260]">
            suppliers
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Cell({
  children,
  rowLabel,
  bold,
  mono,
}: {
  children: React.ReactNode;
  rowLabel?: boolean;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        "truncate border-r border-[#EFECD9] px-2 py-1 text-[12px] last:border-r-0",
        rowLabel &&
          "bg-[#E8E4D2] text-center font-mono text-[10px] text-[#7A7260]",
        bold && "font-semibold text-ink",
        mono && "font-mono text-[11.5px] text-ink-warm",
        !rowLabel && !bold && !mono && "text-ink",
      )}
    >
      {children}
    </div>
  );
}

// Blue Excel-style selection rectangle that hops around the grid.
function SelectionCursor() {
  // Sequence of (col, row) cell coordinates, with positioning computed via
  // CSS grid lines so this works without measuring DOM.
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0"
      // Start from an approximate position, then animate top/left/width/height
      // through the path. The exact pixel values don't have to be perfect;
      // they're chosen to land on visible cells given the row + column sizing
      // used in the grid above.
      initial={{ top: 28, left: 40, width: 220, height: 24, opacity: 0 }}
      animate={{
        opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        top: [28, 28, 84, 140, 168, 196, 252, 308, 336, 336],
        left: [40, 480, 40, 280, 760, 836, 40, 220, 40, 40],
        width: [220, 240, 220, 80, 50, 80, 220, 80, 220, 220],
        height: [24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
      }}
      transition={{
        duration: 6,
        ease: "easeInOut",
        times: [0, 0.06, 0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.9, 1],
      }}
      style={{
        outline: "2px solid #217346",
        outlineOffset: "-1px",
        boxShadow:
          "inset 0 0 0 1px rgba(33, 115, 70, 0.15), 0 0 0 1px rgba(33, 115, 70, 0.08)",
      }}
    />
  );
}
