"use client";

import { ReviewScreen } from "./review-screen";
import type { ReviewData } from "./types";

const SAMPLE_DATA: ReviewData = {
  fileName: "Inv_243192_from_Zabiha_Halal_Meat_Processors_50728.pdf",
  page: 1,
  pages: 1,
  size: "455.9 KB",
  parsed: {
    supplier: {
      value: "Zabiha Halal Meat Processors",
      confidence: 42,
      matched: false,
      candidates: [
        { name: "Zabiha Halal Meat Processing Co.", score: 78 },
        { name: "Halal Meat Processors LLC", score: 62 },
      ],
    },
    invoiceNumber: { value: "243192", confidence: 98 },
    invoiceDate: { value: "2026-04-20", confidence: 96 },
    receiveDate: { value: "2026-04-20", confidence: 60, note: "defaulted to invoice date" },
    total: { value: 3029.85, confidence: 99 },
  },
  lines: [
    {
      id: 1,
      raw: "RR Brisket Short Rib · Brisket Short Rib",
      cases: 1,
      weight: 56.6,
      unitPrice: 6.55,
      total: 370.73,
      match: {
        status: "matched",
        product: "Brisket Short Ribs (Dino)",
        sku: "BSR-DINO",
        score: 45,
        candidates: [],
      },
    },
    {
      id: 2,
      raw: "RR Brisket Point Prime · BEEF PRIME BRISKET POINT EXP",
      cases: 2,
      weight: 25.2,
      unitPrice: 6.55,
      total: 165.06,
      match: { status: "unmatched", candidates: [] },
    },
    {
      id: 3,
      raw: "RR Rib Eye",
      cases: 1,
      weight: 79.1,
      unitPrice: 5.75,
      total: 454.83,
      match: {
        status: "unmatched",
        candidates: [
          { name: "Ribeye Steak — Choice", sku: "RIB-CHC", score: 71 },
          { name: "Ribeye Roll", sku: "RIB-RLL", score: 58 },
        ],
      },
    },
    {
      id: 4,
      raw: "2x20 Gyros Cones · Fatima Halal Small Cones (2 cones per case · 20lbs each)",
      cases: 1,
      weight: 15.9,
      unitPrice: 12.8,
      total: 203.52,
      match: { status: "unmatched", candidates: [] },
    },
    {
      id: 5,
      raw: "RR Bladerst CH/RL · BEEF BLADE EYE EXP",
      cases: 10,
      weight: 0,
      unitPrice: 143.0,
      total: 1430.0,
      fixed: true,
      match: { status: "unmatched", candidates: [] },
    },
    {
      id: 6,
      raw: "80/20 Beef",
      cases: 2,
      weight: 60.5,
      unitPrice: 4.89,
      total: 295.84,
      match: {
        status: "matched",
        product: "80/20 Ground Beef",
        sku: "GB-80-20",
        score: 96,
        candidates: [],
      },
    },
    {
      id: 7,
      raw: "Chicken Ham Deli Sliced · Smoked & Sliced @ 12 oz packages",
      cases: 1,
      weight: 17.7,
      unitPrice: 5.4,
      total: 95.58,
      match: {
        status: "matched",
        product: "Chicken Tenders",
        sku: "CHK-TND",
        score: 24,
        warning: "Low confidence — review",
        candidates: [{ name: "Chicken Ham, Sliced", sku: "CHK-HAM", score: 88 }],
      },
    },
    {
      id: 8,
      raw: "Pastrami · Approx 12 oz Packets",
      cases: 1,
      weight: 0,
      unitPrice: 6.09,
      total: 6.09,
      fixed: true,
      match: { status: "unmatched", candidates: [] },
    },
    {
      id: 9,
      raw: "Delivery Fee",
      cases: 1,
      weight: 0,
      unitPrice: 8.19,
      total: 8.19,
      fixed: true,
      match: { status: "fee", candidates: [] },
    },
  ],
};

export function ReviewDemo() {
  return <ReviewScreen data={SAMPLE_DATA} />;
}
