"use client";

import { useEffect, useState } from "react";

import { ParsingProgressScreen } from "./parsing-progress-screen";
import type { ParseJobView } from "./types";

const SAMPLE_LINES: ParseJobView["lines"] = [
  { id: 1, state: "parsed", raw: "RR Brisket Short Rib · Brisket Short Rib", total: "$370.73" },
  { id: 2, state: "parsed", raw: "RR Brisket Point Prime · BEEF PRIME BRISKET POINT EXP", total: "$165.06" },
  { id: 3, state: "parsed", raw: "RR Rib Eye", total: "$454.83" },
  { id: 4, state: "parsed", raw: "2x20 Gyros Cones · Fatima Halal Small Cones", total: "$203.52" },
  { id: 5, state: "parsed", raw: "RR Bladerst CH/RL · BEEF BLADE EYE EXP", total: "$1,430.00" },
  { id: 6, state: "parsing", raw: "80/20 Beef" },
  { id: 7, state: "pending" },
  { id: 8, state: "pending" },
  { id: 9, state: "pending" },
];

const SAMPLE_STAGES: ParseJobView["stages"] = [
  { id: "upload",  label: "Upload",           status: "done",    detail: "455.9 KB · 1 page",         time: "0.3s" },
  { id: "extract", label: "Text extraction",  status: "done",    detail: "1,284 tokens",              time: "0.8s" },
  { id: "tables",  label: "Table detection",  status: "done",    detail: "1 table · 9 rows",          time: "0.6s" },
  { id: "lines",   label: "Line items",       status: "running", detail: "parsed 6 of 9 lines…",      time: "live" },
  { id: "match",   label: "Product matching", status: "running", detail: "searching catalog…",        time: "live" },
  { id: "fees",    label: "Fees & tax",       status: "queued",  detail: "detect freight, fuel, tax" },
  { id: "recon",   label: "Reconciliation",   status: "queued",  detail: "cross-check totals" },
];

export function ParsingProgressDemo() {
  const [elapsed, setElapsed] = useState(2.4);
  const [progress, setProgress] = useState(38);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(e => +(e + 0.1).toFixed(1));
      setProgress(p => Math.min(100, p + 0.6));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const job: ParseJobView = {
    fileName: "Inv_243192_from_Zabiha_Halal_Meat_Processors_50728.pdf",
    fileSizeLabel: "455.9 KB",
    uploadedLabel: "uploaded just now",
    elapsedSeconds: elapsed,
    overallProgress: progress,
    stages: SAMPLE_STAGES,
    header: {
      supplier: "Zabiha Halal Meat Processors",
      invoiceNumber: "243192",
      date: "04/20/2026",
      total: "$3,029.85",
    },
    lines: SAMPLE_LINES,
    lineCountLabel: "6 of 9",
    averageParseLabel: "Average parse: ~3.2s",
  };

  return <ParsingProgressScreen job={job} />;
}
