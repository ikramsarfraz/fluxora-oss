"use client";

import { BulkLandingScreen } from "./bulk-landing-screen";
import type { BatchFile, BatchView } from "./types";

const SAMPLE_FILES: BatchFile[] = [
  {
    id: "f1",
    name: "Invoice_137098.pdf",
    supplier: "Brewer Livestock Co.",
    invoiceNumber: "137098",
    lineCount: 3,
    totalAmount: 1446.83,
    confidence: 78,
    status: "reviewed",
    issues: [{ tone: "warn", message: "1 of 3 lines unmatched" }],
    elapsedLabel: "2m ago",
  },
  {
    id: "f2",
    name: "Inv_243192_from_Zabiha_Halal_Meat_Processors_50728.pdf",
    supplier: "Zabiha Halal Meat Processors",
    invoiceNumber: "243192",
    lineCount: 9,
    totalAmount: 3029.85,
    confidence: 42,
    status: "attention",
    issues: [
      { tone: "danger", message: "Supplier not in directory" },
      { tone: "danger", message: "8 of 9 lines unmatched" },
    ],
    elapsedLabel: "4m ago",
  },
  {
    id: "f3",
    name: "Invoice 57876.pdf",
    supplier: "Summit Trading",
    invoiceNumber: "57876",
    lineCount: 2,
    totalAmount: 1536.8,
    confidence: 65,
    status: "attention",
    issues: [{ tone: "danger", message: "Supplier not in directory" }],
    elapsedLabel: "4m ago",
  },
  {
    id: "f4",
    name: "Sample Invoice.pdf",
    supplier: null,
    invoiceNumber: null,
    lineCount: 9,
    totalAmount: 588.93,
    confidence: 31,
    status: "needs-review",
    issues: [
      { tone: "warn", message: "7 parsing warnings" },
      { tone: "danger", message: "Couldn't read invoice header" },
    ],
    elapsedLabel: "5m ago",
  },
];

export function BulkLandingDemo() {
  const reviewed = SAMPLE_FILES.filter(f => f.status === "reviewed").length;
  const view: BatchView = {
    files: SAMPLE_FILES,
    summary: {
      filesProcessed: SAMPLE_FILES.length,
      readyToPost: reviewed,
      needsReview: SAMPLE_FILES.length - reviewed,
      combinedValue: SAMPLE_FILES.reduce((s, f) => s + f.totalAmount, 0),
    },
  };

  return <BulkLandingScreen view={view} />;
}
