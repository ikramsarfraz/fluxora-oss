import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import React from "react";
import {
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { money, nonNegative } from "@/lib/utils/money";
import type { SalesInvoiceDetail } from "@/modules/distribution/invoices/services/invoicing";

export type InvoicePricingType = "per_lb" | "per_case" | "per_unit";

export type InvoicePdfLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitType: string;
  caseWeights: number[];
  details?: string | null;
  totalWeight: number | null;
  unitPrice: number;
  pricingType: InvoicePricingType;
  /**
   * Optional explicit abbreviation for the unit-price suffix. When set,
   * overrides the per_lb/per_case/per_unit default mapping — e.g. a
   * milk product priced per gallon snapshots "gal" here so the PDF
   * prints "$ 4.50 / gal" instead of "$ 4.50 / lb".
   */
  pricingUnitAbbreviation?: string | null;
  lineTotal: number;
};

export type InvoicePdfViewModel = {
  invoiceNumber: string;
  invoiceDate: string | Date | null;
  dueDate?: string | Date | null;
  company: {
    name: string;
    email?: string | null;
    phone?: string | null;
    addressLines: string[];
  };
  customer: {
    name: string;
    phone?: string | null;
    billingAddressLines: string[];
    shippingAddressLines: string[];
  };
  logoUrl?: string | null;
  lines: InvoicePdfLineItem[];
  totals: {
    totalItems: number;
    totalWeight: number;
    subtotal: number;
    discount: number;
    fuelSurcharge: number;
    taxRate: number;
    taxAmount: number;
    grandTotal: number;
  };
  payment: {
    due: string;
    zelleEmail?: string | null;
    checkPayableTo: string;
    creditCardFeePercent: number;
  };
  notes: string[];
};

type InvoiceTenant = {
  name: string;
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  addressLines?: string[] | null;
  branding?: {
    companyLegalName?: string | null;
    displayName?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    invoiceFooterText?: string | null;
    invoiceNotesDefault?: string | null;
  } | null;
};

type CustomerAddress = NonNullable<
  NonNullable<SalesInvoiceDetail["customer"]>["addresses"]
>[number];
type InvoiceLine = SalesInvoiceDetail["lines"][number];
type SalesOrderLine = NonNullable<
  SalesInvoiceDetail["salesOrder"]
>["lines"][number];
type SalesOrderFulfillment = NonNullable<
  SalesOrderLine["fulfillments"]
>[number];

const DEFAULT_PAYMENT_EMAIL =
  process.env.INVOICE_PAYMENT_EMAIL?.trim() || "billing@example.com";
const DEFAULT_COMPANY_NAME =
  process.env.INVOICE_COMPANY_NAME?.trim() || "Acme Distribution LLC";
const DEFAULT_COMPANY_PHONE = process.env.INVOICE_PHONE?.trim() || null;
const DEFAULT_COMPANY_ADDRESS_LINES =
  process.env.INVOICE_ADDRESS_LINES?.split("|")
    .map(line => line.trim())
    .filter(Boolean) ?? ["Indianapolis, IN"];
const DEFAULT_PAYMENT_DUE = "upon delivery";
const DEFAULT_NOTES = [
  "All meat products are 100% Zabiha, hand-slaughtered",
  "No returns after delivery",
  "Please inspect all goods upon receiving",
  "Place weekly orders by Sunday evening",
];
const DEFAULT_TAX_RATE = 0.07;
const DEFAULT_PAGE_SIZE: [number, number] = [612, 792];
const STYLE_OVERRIDES_PATH = join(
  process.cwd(),
  "lib/invoices/sales-invoice-pdf.overrides.json",
);

function toNumber(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumNumbers(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function formatPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatInvoiceDate(value: string | Date | null | undefined) {
  return formatDisplayDate(value).replace(/^0/, "").replace(/\/0/g, "/");
}

function formatWeight(value: string | number | null | undefined) {
  return toNumber(value).toFixed(2);
}

function formatQuantity(value: string | number | null | undefined) {
  const numeric = toNumber(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
}

function formatPercent(value: number) {
  const percent = value * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}

function formatUnitPrice(
  value: number,
  pricingType: InvoicePricingType,
  pricingUnitAbbreviation?: string | null,
) {
  // Explicit snapshot abbreviation wins so beverage / non-lb products
  // render with their actual UOM ("/ gal", "/ ea", "/ case of 12"). When
  // no snapshot is available, fall back to the pricing-type defaults
  // (per_lb / per_case / per_unit) so historical invoices keep printing
  // the same suffixes.
  const explicit = pricingUnitAbbreviation?.trim();
  const suffix = explicit
    ? ` / ${explicit}`
    : pricingType === "per_lb"
      ? " / lb"
      : pricingType === "per_case"
        ? " / case"
        : " / unit";
  return `${formatMoney(value)}${suffix}`;
}

function parseCaseWeights(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(item => toNumber(typeof item === "string" ? item : Number(item)))
      .filter(weight => weight > 0);
  } catch {
    return [];
  }
}

function safePdfFilename(invoiceNumber: string) {
  const cleaned = invoiceNumber.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${cleaned || "invoice"}.pdf`;
}

function getCompanyName(tenant: InvoiceTenant) {
  return (
    tenant.branding?.companyLegalName?.trim() ||
    tenant.branding?.displayName?.trim() ||
    tenant.name ||
    DEFAULT_COMPANY_NAME
  );
}

function getCompanyAddressLines(tenant: InvoiceTenant) {
  const configured = tenant.addressLines?.filter(Boolean) ?? [];
  return configured.length > 0 ? configured : DEFAULT_COMPANY_ADDRESS_LINES;
}

function getBrandDisplayName(tenant: InvoiceTenant) {
  return tenant.branding?.displayName?.trim() || getCompanyName(tenant);
}

function getAddressByType(
  customer: SalesInvoiceDetail["customer"],
  addressType: "billing" | "shipping",
): CustomerAddress | null {
  if (!customer?.addresses?.length) return null;
  return (
    customer.addresses.find(address => address.addressType === addressType) ??
    customer.addresses.find(address => address.isDefault) ??
    customer.addresses[0] ??
    null
  );
}

function getAddressLines(address: CustomerAddress | null) {
  if (!address) return [];
  const cityLine = [address.city, address.state, address.zip]
    .filter(Boolean)
    .join("  ");
  return [address.street, cityLine].filter(Boolean);
}

function getPaymentEmail(tenant: InvoiceTenant) {
  const configuredText = [
    tenant.email,
    tenant.branding?.invoiceNotesDefault,
    tenant.branding?.invoiceFooterText,
  ]
    .filter(Boolean)
    .join("\n");
  const configuredEmail = configuredText.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  )?.[0];

  if (configuredEmail) return configuredEmail;

  return /prime/i.test(getBrandDisplayName(tenant))
    ? DEFAULT_PAYMENT_EMAIL
    : null;
}

function parseNotes(value: string | null | undefined) {
  const lines = value
    ?.split(/\r?\n/)
    .map(line => line.trim().replace(/^\*+\s*/, ""))
    .filter(Boolean);

  if (lines?.length === 1 && /remit payment by the due date/i.test(lines[0])) {
    return DEFAULT_NOTES;
  }

  return lines?.length ? lines : DEFAULT_NOTES;
}

function supportsPdfImage(logoUrl: string | null | undefined) {
  if (!logoUrl) return false;
  return /\.(png|jpe?g)(?:\?|#|$)/i.test(logoUrl);
}

function getBrandLines(displayName: string) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  const withoutLlc = normalized.replace(/\bLLC\b\.?/i, "").trim();
  const words = withoutLlc.split(" ").filter(Boolean);
  return {
    headline: (words[0] || normalized).toUpperCase(),
    subhead: words.slice(1).join(" ").toUpperCase(),
    tagline: "",
  };
}

function getDateTime(value: string | Date | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function fulfillmentWeight(fulfillment: SalesOrderFulfillment) {
  const capturedWeight = toNumber(fulfillment.weightLbs);
  if (capturedWeight > 0) return capturedWeight;

  const inventoryWeight = toNumber(fulfillment.inventoryItem?.exactWeightLbs);
  return inventoryWeight > 0 ? inventoryWeight : null;
}

function findOrderLineForInvoiceLine({
  invoiceLine,
  orderLines,
  usedOrderLineIds,
}: {
  invoiceLine: InvoiceLine;
  orderLines: SalesOrderLine[];
  usedOrderLineIds: Set<string>;
}) {
  const candidates = orderLines.filter(
    orderLine =>
      orderLine.productId === invoiceLine.productId &&
      !usedOrderLineIds.has(orderLine.id),
  );

  if (candidates.length === 0) return null;

  const invoiceWeight = toNumber(invoiceLine.billedWeightLbs);
  const invoiceQuantity = toNumber(invoiceLine.quantityCases);
  const matchesWeight = (orderLine: SalesOrderLine) =>
    Math.abs(toNumber(orderLine.totalBilledWeightLbs) - invoiceWeight) < 0.01;
  const matchesQuantity = (orderLine: SalesOrderLine) =>
    toNumber(orderLine.fulfilledCases || orderLine.expectedCases) ===
    invoiceQuantity;

  return (
    candidates.find(
      orderLine => matchesWeight(orderLine) && matchesQuantity(orderLine),
    ) ??
    candidates.find(matchesWeight) ??
    candidates[0] ??
    null
  );
}

function getIndividualWeights({
  invoiceLine,
  orderLine,
}: {
  invoiceLine: InvoiceLine;
  orderLine: SalesOrderLine | null;
}) {
  const fulfillmentWeights = [...(orderLine?.fulfillments ?? [])]
    .filter(fulfillment => !fulfillment.reversedAt)
    .sort((a, b) => getDateTime(a.fulfilledAt) - getDateTime(b.fulfilledAt))
    .map(fulfillmentWeight)
    .filter((weight): weight is number => weight != null && weight > 0);

  if (fulfillmentWeights.length > 0) return fulfillmentWeights;

  const caseWeights = parseCaseWeights(orderLine?.caseWeightsLbs);
  if (caseWeights.length > 0) return caseWeights;

  const quantity = toNumber(invoiceLine.quantityCases);
  const invoiceWeight = toNumber(invoiceLine.billedWeightLbs);
  return quantity === 1 && invoiceWeight > 0 ? [invoiceWeight] : [];
}

function getPricingType(orderLine: SalesOrderLine | null): InvoicePricingType {
  if (orderLine?.pricingUnitTypeSnapshot === "per_case") return "per_case";
  // Map all non-weight intrinsic types onto per_case so the PDF math
  // (cases × price) kicks in for beverages and dry goods. The snapshot
  // abbreviation propagated alongside still renders "/ ea" / "/ case"
  // correctly in the suffix.
  if (
    orderLine?.unitType === "fixed_case" ||
    orderLine?.unitType === "per_each" ||
    orderLine?.unitType === "per_unit"
  ) {
    return "per_case";
  }
  return "per_lb";
}

function getUnitType(orderLine: SalesOrderLine | null, pricingType: InvoicePricingType) {
  const configured =
    orderLine?.salesUnitAbbreviationSnapshot ||
    orderLine?.salesUnitNameSnapshot ||
    null;
  if (configured) return configured;
  if (pricingType === "per_lb") return "cases";
  if (pricingType === "per_case") return "cases";
  return "units";
}

function buildLineDetails({
  orderLine,
  pricingType,
}: {
  orderLine: SalesOrderLine | null;
  pricingType: InvoicePricingType;
}) {
  if (pricingType === "per_lb") return null;
  return (
    orderLine?.salesUnitNameSnapshot ||
    orderLine?.salesUnitAbbreviationSnapshot ||
    null
  );
}

function buildInvoiceLineItems(invoice: SalesInvoiceDetail) {
  const orderLines = invoice.salesOrder?.lines ?? [];
  const usedOrderLineIds = new Set<string>();

  return (invoice.lines ?? []).map(line => {
    const orderLine = findOrderLineForInvoiceLine({
      invoiceLine: line,
      orderLines,
      usedOrderLineIds,
    });
    if (orderLine) {
      usedOrderLineIds.add(orderLine.id);
    }

    const pricingType = getPricingType(orderLine);
    const caseWeights = getIndividualWeights({ invoiceLine: line, orderLine });
    const weightFromCases = sumNumbers(caseWeights);
    const invoiceWeight = toNumber(line.billedWeightLbs);
    const totalWeight =
      pricingType === "per_lb"
        ? roundMoney(weightFromCases > 0 ? weightFromCases : invoiceWeight)
        : null;

    const productName = line.product?.name?.trim();
    if (!productName) {
      console.warn(
        "[sales-invoice-pdf] missing product name; falling back to product id",
        { invoiceLineId: line.id, productId: line.productId },
      );
    }

    // Carry the snapshot abbreviation forward so the PDF renders the
    // suffix the order was actually priced in (e.g. "/ gal" for milk,
    // "/ case" for soda) rather than the pricing-type default.
    const pricingUnitAbbreviation =
      orderLine?.salesUnitAbbreviationSnapshot ?? null;

    return {
      id: line.id,
      description: productName ?? line.productId ?? "Unnamed product",
      quantity: toNumber(line.quantityCases),
      unitType: getUnitType(orderLine, pricingType),
      caseWeights,
      details: buildLineDetails({ orderLine, pricingType }),
      totalWeight,
      unitPrice: toNumber(line.unitPrice),
      pricingType,
      pricingUnitAbbreviation,
      lineTotal: toNumber(line.lineTotal),
    } satisfies InvoicePdfLineItem;
  });
}

function buildInvoiceTotals(invoice: SalesInvoiceDetail, lines: InvoicePdfLineItem[]) {
  // Tax is derived rather than stored: grandTotal − (subtotal − discount +
  // fuelSurcharge). With Number arithmetic this subtraction can leak a
  // phantom 0.01 onto a clean no-tax invoice (subtotal sums of fractional
  // weights drift, then grandTotal − preTaxTotal ≠ 0). Decimal makes
  // the subtraction exact so no-tax stays no-tax.
  const subtotalD = money(invoice.subtotal);
  const discountD = money(invoice.discountAmount).plus(
    money(invoice.creditAmount),
  );
  const fuelSurchargeD = money(invoice.fuelSurchargeAmount);
  const grandTotalD = money(invoice.totalAmount);
  const preTaxTotalD = subtotalD.minus(discountD).plus(fuelSurchargeD);
  const taxAmountD = nonNegative(grandTotalD.minus(preTaxTotalD));
  const taxRateD =
    taxAmountD.gt(0) && preTaxTotalD.gt(0)
      ? taxAmountD.div(preTaxTotalD)
      : money(0);

  return {
    totalItems: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalWeight: lines.reduce((sum, line) => sum + (line.totalWeight ?? 0), 0),
    subtotal: subtotalD.toNumber(),
    discount: discountD.toNumber(),
    fuelSurcharge: fuelSurchargeD.toNumber(),
    taxRate: Number(taxRateD.toFixed(4)),
    taxAmount: Number(taxAmountD.toFixed(2)),
    grandTotal: grandTotalD.toNumber(),
  };
}

export function buildSalesInvoicePdfViewModel(args: {
  tenant: InvoiceTenant;
  invoice: SalesInvoiceDetail;
  logoUrl?: string | null;
}): InvoicePdfViewModel {
  const { tenant, invoice, logoUrl } = args;
  const companyName = getCompanyName(tenant);
  const paymentEmail = getPaymentEmail(tenant);
  const billingAddress = getAddressByType(invoice.customer, "billing");
  const shippingAddress = getAddressByType(invoice.customer, "shipping");
  const billingAddressLines = getAddressLines(billingAddress);
  const shippingAddressLines = getAddressLines(shippingAddress);
  const lines = buildInvoiceLineItems(invoice);

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    company: {
      name: companyName,
      email: paymentEmail,
      phone: formatPhone(tenant.phone ?? tenant.phoneNumber ?? DEFAULT_COMPANY_PHONE),
      addressLines: getCompanyAddressLines(tenant),
    },
    customer: {
      name: invoice.customer?.name ?? "Customer",
      phone: formatPhone(invoice.customer?.phoneNumber),
      billingAddressLines,
      shippingAddressLines:
        shippingAddressLines.length > 0 ? shippingAddressLines : billingAddressLines,
    },
    logoUrl,
    lines,
    totals: buildInvoiceTotals(invoice, lines),
    payment: {
      due: DEFAULT_PAYMENT_DUE,
      zelleEmail: paymentEmail,
      checkPayableTo: companyName,
      creditCardFeePercent: 0.03,
    },
    notes: parseNotes(tenant.branding?.invoiceNotesDefault),
  };
}

let pageSize: [number, number] = DEFAULT_PAGE_SIZE;

let styles = StyleSheet.create({
  page: {
    paddingTop: 156,
    paddingBottom: 54,
    paddingHorizontal: 32,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },
  fixedHeader: {
    position: "absolute",
    top: 24,
    left: 32,
    right: 32,
    height: 102,
    borderBottomWidth: 1,
    borderBottomColor: "#C9CDD2",
    borderBottomStyle: "solid",
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerRow1: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerRow2: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E8EAED",
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  invoiceTitleBlock: {
    alignItems: "flex-end",
  },
  companyContactBlock: {
    width: "36%",
  },
  brandBlock: {
    width: "36%",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  uploadedLogo: {
    width: 104,
    height: 40,
    objectFit: "contain",
    marginBottom: 5,
  },
  logoMark: {
    width: 24,
    height: 19,
    marginRight: 5,
  },
  logoHeadline: {
    fontSize: 18,
    lineHeight: 0.9,
    fontWeight: 700,
    color: "#123F73",
  },
  logoSubhead: {
    fontSize: 6.8,
    lineHeight: 1.1,
    fontWeight: 700,
    color: "#123F73",
  },
  logoTagline: {
    marginLeft: 29,
    marginTop: 1,
    fontSize: 6.8,
    fontStyle: "italic",
    fontWeight: 700,
    color: "#195991",
  },
  companyName: {
    fontSize: 9.5,
    fontWeight: 700,
    marginBottom: 2,
  },
  contactLine: {
    fontSize: 7.2,
    lineHeight: 1.25,
    color: "#333333",
  },
  invoiceBlock: {
    width: "24%",
    alignItems: "flex-start",
  },
  invoiceTitle: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 0,
    marginBottom: 7,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 7.4,
    color: "#555555",
  },
  metaValue: {
    fontSize: 7.6,
    fontWeight: 700,
  },
  customerBlock: {
    width: "36%",
    flexDirection: "row",
    gap: 9,
  },
  addressColumn: {
    width: "50%",
  },
  blockLabel: {
    fontSize: 6.8,
    color: "#555555",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  addressName: {
    fontSize: 8.2,
    fontWeight: 700,
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 7.2,
    lineHeight: 1.18,
  },
  fixedTableHeader: {
    position: "absolute",
    top: 135,
    left: 32,
    right: 32,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EEF0F2",
    borderTopWidth: 1,
    borderTopColor: "#9CA3AF",
    borderTopStyle: "solid",
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    borderBottomStyle: "solid",
  },
  headerCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 6.8,
    fontWeight: 700,
    color: "#202020",
    textTransform: "uppercase",
    borderRightWidth: 1,
    borderRightColor: "#D5D8DC",
    borderRightStyle: "solid",
  },
  table: {
    borderLeftWidth: 1,
    borderLeftColor: "#D5D8DC",
    borderLeftStyle: "solid",
    borderRightWidth: 1,
    borderRightColor: "#D5D8DC",
    borderRightStyle: "solid",
  },
  lineGroup: {
    borderBottomWidth: 1,
    borderBottomColor: "#D5D8DC",
    borderBottomStyle: "solid",
  },
  mainRow: {
    flexDirection: "row",
    minHeight: 25,
  },
  detailRow: {
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
  },
  cell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#E2E4E7",
    borderRightStyle: "solid",
  },
  detailCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#E2E4E7",
    borderRightStyle: "solid",
  },
  cellLast: {
    borderRightWidth: 0,
  },
  itemCol: {
    width: "24%",
  },
  qtyCol: {
    width: "7%",
    textAlign: "right",
  },
  unitCol: {
    width: "9%",
  },
  detailsCol: {
    width: "27%",
  },
  weightCol: {
    width: "11%",
    textAlign: "right",
  },
  unitPriceCol: {
    width: "10%",
    textAlign: "right",
  },
  totalCol: {
    width: "12%",
    textAlign: "right",
  },
  itemName: {
    fontSize: 8.8,
    fontWeight: 700,
    lineHeight: 1.15,
  },
  mutedText: {
    color: "#666666",
  },
  numericText: {
    fontSize: 8.2,
  },
  totalText: {
    fontSize: 8.5,
    fontWeight: 700,
  },
  detailsText: {
    fontSize: 6.9,
    lineHeight: 1.25,
    color: "#333333",
  },
  detailsPrefix: {
    fontWeight: 700,
  },
  finalSection: {
    marginTop: 14,
    gap: 12,
  },
  totalsPanel: {
    marginLeft: "auto",
    width: 240,
    borderTopWidth: 1,
    borderTopColor: "#9CA3AF",
    borderTopStyle: "solid",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#D5D8DC",
    borderBottomStyle: "solid",
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  totalsLabel: {
    fontSize: 8.2,
    color: "#333333",
  },
  totalsValue: {
    fontSize: 8.4,
    textAlign: "right",
  },
  grandTotalRow: {
    backgroundColor: "#EEF0F2",
    paddingVertical: 7,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "right",
  },
  paymentNotesRow: {
    flexDirection: "row",
    gap: 14,
  },
  paymentBox: {
    width: "42%",
    borderWidth: 1,
    borderColor: "#D5D8DC",
    borderStyle: "solid",
    padding: 9,
  },
  notesBox: {
    width: "58%",
    borderWidth: 1,
    borderColor: "#D5D8DC",
    borderStyle: "solid",
    padding: 9,
  },
  sectionHeading: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionLine: {
    fontSize: 7.7,
    lineHeight: 1.35,
    marginBottom: 3,
  },
  fixedFooter: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 22,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#C9CDD2",
    borderTopStyle: "solid",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    width: "33%",
    fontSize: 7,
    color: "#555555",
  },
  footerCenter: {
    textAlign: "center",
  },
  footerRight: {
    textAlign: "right",
  },
});

const baseStyles = styles;

type InvoicePdfStyleOverrides = {
  pageSize?: [number, number];
  styles?: Partial<
    Record<keyof typeof baseStyles, Partial<(typeof baseStyles)[keyof typeof baseStyles]>>
  >;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPageSize(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(item => typeof item === "number" && Number.isFinite(item))
  );
}

function readDevStyleOverrides(): InvoicePdfStyleOverrides | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (!existsSync(STYLE_OVERRIDES_PATH)) return null;

  const parsed = JSON.parse(
    readFileSync(STYLE_OVERRIDES_PATH, "utf8"),
  ) as unknown;

  if (!isPlainObject(parsed)) {
    throw new Error("Invoice PDF style overrides must be a JSON object.");
  }

  const overrides: InvoicePdfStyleOverrides = {};

  if (parsed.pageSize !== undefined) {
    if (!isPageSize(parsed.pageSize)) {
      throw new Error(
        "Invoice PDF style override `pageSize` must be [width, height].",
      );
    }
    overrides.pageSize = parsed.pageSize;
  }

  if (parsed.styles !== undefined) {
    if (!isPlainObject(parsed.styles)) {
      throw new Error("Invoice PDF style override `styles` must be an object.");
    }
    overrides.styles = parsed.styles as InvoicePdfStyleOverrides["styles"];
  }

  return overrides;
}

function applyRuntimeStyleOverrides() {
  const overrides = readDevStyleOverrides();
  pageSize = overrides?.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!overrides?.styles) {
    styles = baseStyles;
    return;
  }

  const mergedStyles: Record<string, unknown> = { ...baseStyles };
  for (const [styleName, styleOverride] of Object.entries(overrides.styles)) {
    if (!(styleName in baseStyles) || !isPlainObject(styleOverride)) {
      continue;
    }

    mergedStyles[styleName] = {
      ...baseStyles[styleName as keyof typeof baseStyles],
      ...styleOverride,
    };
  }

  styles = StyleSheet.create(mergedStyles as typeof baseStyles);
}

function BrandLogo({
  viewModel,
}: {
  viewModel: InvoicePdfViewModel;
}) {
  const brandLines = getBrandLines(viewModel.company.name);
  const primaryColor = "#123F73";
  const secondaryColor = "#195991";

  if (supportsPdfImage(viewModel.logoUrl)) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image src={viewModel.logoUrl!} style={styles.uploadedLogo} />;
  }

  return (
    <View>
      <View style={styles.logoRow}>
        <Svg style={styles.logoMark} viewBox="0 0 54 42">
          <Path
            d="M13 5 L33 5 L51 21 L33 37 L13 37 L30 21 Z"
            fill={primaryColor}
          />
          <Path d="M1 21 L13 8 L29 21 L13 34 Z" fill={secondaryColor} />
          <Path d="M13 8 L30 21 L13 34 L22 21 Z" fill="#0A2D55" />
        </Svg>
        <View>
          <Text style={styles.logoHeadline}>{brandLines.headline}</Text>
          {brandLines.subhead ? (
            <Text style={styles.logoSubhead}>{brandLines.subhead}</Text>
          ) : null}
        </View>
      </View>
      {brandLines.tagline ? (
        <Text style={styles.logoTagline}>{brandLines.tagline}</Text>
      ) : null}
    </View>
  );
}

function AddressBlock({
  label,
  name,
  lines,
  phone,
}: {
  label: string;
  name: string;
  lines: string[];
  phone?: string | null;
}) {
  return (
    <View style={styles.addressColumn}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={styles.addressName}>{name}</Text>
      {lines.length > 0 ? (
        lines.map(line => (
          <Text key={`${label}-${line}`} style={styles.addressLine}>
            {line}
          </Text>
        ))
      ) : (
        <Text style={[styles.addressLine, styles.mutedText]}>No address on file</Text>
      )}
      {phone ? <Text style={styles.addressLine}>{phone}</Text> : null}
    </View>
  );
}

function InvoiceHeader({ viewModel }: { viewModel: InvoicePdfViewModel }) {
  const contactLines = [
    ...viewModel.company.addressLines,
    viewModel.company.phone ?? null,
    viewModel.company.email ?? null,
  ].filter((value): value is string => Boolean(value));

  return (
    <View fixed style={styles.fixedHeader}>
      <View style={styles.headerRow1}>
        <View style={styles.brandBlock}>
          <BrandLogo viewModel={viewModel} />
        </View>
        <View style={styles.invoiceTitleBlock}>
          <Text style={styles.invoiceTitle}>Invoice</Text>
        </View>
      </View>

      <View style={styles.headerRow2}>
        <View style={styles.companyContactBlock}>
          <Text style={styles.companyName}>{viewModel.company.name}</Text>
          {contactLines.map(line => (
            <Text key={line} style={styles.contactLine}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.invoiceBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice #</Text>
            <Text style={styles.metaValue}>{viewModel.invoiceNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>
              {formatInvoiceDate(viewModel.invoiceDate)}
            </Text>
          </View>
          {viewModel.dueDate ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due</Text>
              <Text style={styles.metaValue}>
                {formatInvoiceDate(viewModel.dueDate)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.customerBlock}>
          <AddressBlock
            label="Bill To"
            name={viewModel.customer.name}
            lines={viewModel.customer.billingAddressLines}
            phone={viewModel.customer.phone}
          />
          <AddressBlock
            label="Ship To"
            name={viewModel.customer.name}
            lines={viewModel.customer.shippingAddressLines}
          />
        </View>
      </View>
    </View>
  );
}

function TableHeader({ fixed = false }: { fixed?: boolean }) {
  return (
    <View fixed={fixed} style={fixed ? styles.fixedTableHeader : undefined}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.headerCell, styles.itemCol]}>Item / Description</Text>
        <Text style={[styles.headerCell, styles.qtyCol]}>Qty</Text>
        <Text style={[styles.headerCell, styles.unitCol]}>Unit Type</Text>
        <Text style={[styles.headerCell, styles.detailsCol]}>
          Case Weights / Details
        </Text>
        <Text style={[styles.headerCell, styles.weightCol]}>Total Weight</Text>
        <Text style={[styles.headerCell, styles.unitPriceCol]}>Unit Price</Text>
        <Text style={[styles.headerCell, styles.totalCol, styles.cellLast]}>
          Line Total
        </Text>
      </View>
    </View>
  );
}

function CaseWeightsDetail({ line }: { line: InvoicePdfLineItem }) {
  if (line.caseWeights.length > 0) {
    return (
      <Text style={styles.detailsText}>
        <Text style={styles.detailsPrefix}>Case Weights: </Text>
        {line.caseWeights.map(weight => formatWeight(weight)).join(" / ")}
      </Text>
    );
  }

  return (
    <Text style={styles.detailsText}>
      {line.details?.trim() ? line.details : "-"}
    </Text>
  );
}

function InvoiceLineRow({ line }: { line: InvoicePdfLineItem }) {
  const hasSubRow = line.caseWeights.length > 0;
  const keepTogether = line.caseWeights.length <= 80;

  return (
    <View style={styles.lineGroup} wrap={!keepTogether}>
      <View style={styles.mainRow}>
        <View style={[styles.cell, styles.itemCol]}>
          <Text style={styles.itemName}>{line.description}</Text>
        </View>
        <Text style={[styles.cell, styles.qtyCol, styles.numericText]}>
          {formatQuantity(line.quantity)}
        </Text>
        <Text style={[styles.cell, styles.unitCol, styles.numericText]}>
          {line.unitType}
        </Text>
        <Text style={[styles.cell, styles.detailsCol, styles.mutedText]}>
          {hasSubRow ? "Case weights below" : line.details?.trim() || "-"}
        </Text>
        <Text style={[styles.cell, styles.weightCol, styles.numericText]}>
          {line.totalWeight == null ? "-" : formatWeight(line.totalWeight)}
        </Text>
        <Text style={[styles.cell, styles.unitPriceCol, styles.numericText]}>
          {formatUnitPrice(line.unitPrice, line.pricingType, line.pricingUnitAbbreviation)}
        </Text>
        <Text style={[styles.cell, styles.totalCol, styles.cellLast, styles.totalText]}>
          {formatMoney(line.lineTotal)}
        </Text>
      </View>

      {hasSubRow ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailCell, styles.itemCol]} />
          <Text style={[styles.detailCell, styles.qtyCol]} />
          <Text style={[styles.detailCell, styles.unitCol]} />
          <View style={[styles.detailCell, styles.detailsCol]}>
            <CaseWeightsDetail line={line} />
          </View>
          <Text style={[styles.detailCell, styles.weightCol]} />
          <Text style={[styles.detailCell, styles.unitPriceCol]} />
          <Text style={[styles.detailCell, styles.totalCol, styles.cellLast]} />
        </View>
      ) : null}
    </View>
  );
}

function TotalsSection({ viewModel }: { viewModel: InvoicePdfViewModel }) {
  const { totals } = viewModel;
  const taxRate = totals.taxRate > 0 ? totals.taxRate : DEFAULT_TAX_RATE;

  return (
    <View style={styles.totalsPanel}>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Total Items</Text>
        <Text style={styles.totalsValue}>{formatQuantity(totals.totalItems)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Total Weight</Text>
        <Text style={styles.totalsValue}>{formatWeight(totals.totalWeight)} lbs</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal</Text>
        <Text style={styles.totalsValue}>{formatMoney(totals.subtotal)}</Text>
      </View>
      {totals.discount > 0 ? (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Discount</Text>
          <Text style={styles.totalsValue}>-{formatMoney(totals.discount)}</Text>
        </View>
      ) : null}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Fuel Surcharge</Text>
        <Text style={styles.totalsValue}>{formatMoney(totals.fuelSurcharge)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Tax ({formatPercent(taxRate)})</Text>
        <Text style={styles.totalsValue}>{formatMoney(totals.taxAmount)}</Text>
      </View>
      <View style={[styles.totalsRow, styles.grandTotalRow]}>
        <Text style={styles.grandTotalLabel}>Grand Total</Text>
        <Text style={styles.grandTotalValue}>{formatMoney(totals.grandTotal)}</Text>
      </View>
    </View>
  );
}

function PaymentAndNotes({ viewModel }: { viewModel: InvoicePdfViewModel }) {
  return (
    <View style={styles.paymentNotesRow}>
      <View style={styles.paymentBox}>
        <Text style={styles.sectionHeading}>Payment</Text>
        <Text style={styles.sectionLine}>Payment Due: {viewModel.payment.due}</Text>
        {viewModel.payment.zelleEmail ? (
          <Text style={styles.sectionLine}>
            Zelle: {viewModel.payment.zelleEmail}
          </Text>
        ) : null}
        <Text style={styles.sectionLine}>
          Check payable to {viewModel.payment.checkPayableTo}
        </Text>
        <Text style={styles.sectionLine}>
          Credit card transactions subject to{" "}
          {formatPercent(viewModel.payment.creditCardFeePercent)} fee
        </Text>
      </View>

      <View style={styles.notesBox}>
        <Text style={styles.sectionHeading}>Notes</Text>
        {viewModel.notes.map(note => (
          <Text key={note} style={styles.sectionLine}>
            - {note}
          </Text>
        ))}
      </View>
    </View>
  );
}

function InvoiceFooter({ companyName }: { companyName: string }) {
  return (
    <View fixed style={styles.fixedFooter}>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          pageNumber < totalPages ? "Continued on next page" : ""
        }
      />
      <Text style={[styles.footerText, styles.footerCenter]}>{companyName}</Text>
      <Text
        style={[styles.footerText, styles.footerRight]}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function InvoicePdfDocument({ viewModel }: { viewModel: InvoicePdfViewModel }) {
  return (
    <Document
      title={viewModel.invoiceNumber}
      author={viewModel.company.name}
      subject={`Invoice ${viewModel.invoiceNumber}`}
    >
      <Page size={pageSize} style={styles.page}>
        <InvoiceHeader viewModel={viewModel} />
        <TableHeader fixed />

        <View style={styles.table}>
          {viewModel.lines.map(line => (
            <InvoiceLineRow key={line.id} line={line} />
          ))}
        </View>

        <View style={styles.finalSection} wrap={false}>
          <TotalsSection viewModel={viewModel} />
          <PaymentAndNotes viewModel={viewModel} />
        </View>

        <InvoiceFooter companyName={viewModel.company.name} />
      </Page>
    </Document>
  );
}

export function getSalesInvoicePdfFilename(invoice: SalesInvoiceDetail) {
  return safePdfFilename(invoice.invoiceNumber);
}

export async function renderInvoicePdfViewModel(viewModel: InvoicePdfViewModel) {
  applyRuntimeStyleOverrides();
  return renderToBuffer(<InvoicePdfDocument viewModel={viewModel} />);
}

export async function renderSalesInvoicePdf(args: {
  tenant: InvoiceTenant;
  invoice: SalesInvoiceDetail;
  logoUrl?: string | null;
}) {
  return renderInvoicePdfViewModel(buildSalesInvoicePdfViewModel(args));
}
