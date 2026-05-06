import type { InvoicePdfLineItem, InvoicePdfViewModel } from "./sales-invoice-pdf";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

const fourCaseWeights = [40, 40, 40, 40];
const fiftyCaseWeights = Array.from({ length: 50 }, (_, index) =>
  roundMoney(39.75 + (index % 8) * 0.17 + Math.floor(index / 8) * 0.03),
);

function meatLine(args: {
  id: string;
  description: string;
  caseWeights: number[];
  unitPrice: number;
}): InvoicePdfLineItem {
  const totalWeight = roundMoney(sum(args.caseWeights));
  return {
    id: args.id,
    description: args.description,
    quantity: args.caseWeights.length,
    unitType: "cases",
    caseWeights: args.caseWeights,
    totalWeight,
    unitPrice: args.unitPrice,
    pricingType: "per_lb",
    lineTotal: roundMoney(totalWeight * args.unitPrice),
  };
}

function packagedLine(args: {
  id: string;
  description: string;
  quantity: number;
  unitType: string;
  details: string;
  unitPrice: number;
}): InvoicePdfLineItem {
  return {
    id: args.id,
    description: args.description,
    quantity: args.quantity,
    unitType: args.unitType,
    caseWeights: [],
    details: args.details,
    totalWeight: null,
    unitPrice: args.unitPrice,
    pricingType: args.unitType === "cases" ? "per_case" : "per_unit",
    lineTotal: roundMoney(args.quantity * args.unitPrice),
  };
}

export function createSampleInvoicePdfViewModel(options?: {
  repeatLongMeatLine?: number;
}): InvoicePdfViewModel {
  const baseLines: InvoicePdfLineItem[] = [
    meatLine({
      id: "sample-meat-normal",
      description: "Chicken Tenders",
      caseWeights: fourCaseWeights,
      unitPrice: 1,
    }),
    meatLine({
      id: "sample-meat-long",
      description: "Beef Brisket - 50 Case Lot",
      caseWeights: fiftyCaseWeights,
      unitPrice: 1.65,
    }),
    packagedLine({
      id: "sample-beverage",
      description: "Beverage Case",
      quantity: 50,
      unitType: "cases",
      details: "12 bottles per case",
      unitPrice: 8,
    }),
  ];

  const repeatedLines = Array.from(
    { length: Math.max(0, options?.repeatLongMeatLine ?? 0) },
    (_, index) => ({
      ...baseLines[1],
      id: `sample-meat-long-repeat-${index + 1}`,
      description: `Beef Brisket - 50 Case Lot ${index + 1}`,
    }),
  );
  const lines = [...baseLines, ...repeatedLines];
  const subtotal = roundMoney(sum(lines.map(line => line.lineTotal)));
  const fuelSurcharge = 10;
  const taxRate = 0.07;
  const taxAmount = 11.83;
  const grandTotal = roundMoney(subtotal + fuelSurcharge + taxAmount);

  return {
    invoiceNumber: "INV-SAMPLE-001",
    invoiceDate: "2026-05-06",
    dueDate: "2026-05-06",
    company: {
      name: "Acme Distribution LLC",
      email: "billing@example.com",
      phone: "(317) 555-0100",
      addressLines: ["Indianapolis, IN"],
    },
    customer: {
      name: "Sample Market",
      phone: "(317) 555-0188",
      billingAddressLines: ["123 Billing Ave", "Indianapolis  IN  46204"],
      shippingAddressLines: ["456 Receiving Dock", "Indianapolis  IN  46222"],
    },
    lines,
    totals: {
      totalItems: sum(lines.map(line => line.quantity)),
      totalWeight: roundMoney(sum(lines.map(line => line.totalWeight ?? 0))),
      subtotal,
      discount: 0,
      fuelSurcharge,
      taxRate,
      taxAmount,
      grandTotal,
    },
    payment: {
      due: "upon delivery",
      zelleEmail: "billing@example.com",
      checkPayableTo: "Acme Distribution LLC",
      creditCardFeePercent: 0.03,
    },
    notes: [
      "All meat products are 100% Zabiha, hand-slaughtered",
      "No returns after delivery",
      "Please inspect all goods upon receiving",
      "Place weekly orders by Sunday evening",
    ],
  };
}

export const sampleInvoicePdfViewModel = createSampleInvoicePdfViewModel();
