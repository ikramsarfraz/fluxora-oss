import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { SalesInvoiceDetail } from "@/services/invoicing";

function toNumber(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function safePdfFilename(invoiceNumber: string) {
  const cleaned = invoiceNumber.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${cleaned || "invoice"}.pdf`;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "right",
    marginBottom: 6,
  },
  rightMeta: {
    textAlign: "right",
    lineHeight: 1.4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
  },
  textLine: {
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderStyle: "solid",
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    borderBottomStyle: "solid",
  },
  tableHeader: {
    backgroundColor: "#E5E7EB",
    fontWeight: 700,
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  skuCell: { width: "14%" },
  descCell: { width: "30%" },
  qtyCell: { width: "12%", textAlign: "right" },
  weightCell: { width: "14%", textAlign: "right" },
  unitCell: { width: "14%", textAlign: "right" },
  totalCell: { width: "16%", textAlign: "right" },
  totalsBlock: {
    marginLeft: "auto",
    width: 220,
    gap: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalsLabel: {
    color: "#4B5563",
  },
  totalsStrong: {
    fontWeight: 700,
  },
});

type InvoicePdfDocumentProps = {
  companyName: string;
  invoice: SalesInvoiceDetail;
};

function InvoicePdfDocument({ companyName, invoice }: InvoicePdfDocumentProps) {
  const totalCogs = (invoice.lines ?? []).reduce(
    (sum, line) => sum + toNumber(line.cogsAmountSnapshot),
    0,
  );
  const grossProfit = toNumber(invoice.totalAmount) - totalCogs;
  const marginPercent =
    toNumber(invoice.totalAmount) > 0
      ? (grossProfit / toNumber(invoice.totalAmount)) * 100
      : 0;

  return (
    <Document
      title={invoice.invoiceNumber}
      author={companyName}
      subject={`Invoice ${invoice.invoiceNumber}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.rightMeta}>Invoice #: {invoice.invoiceNumber}</Text>
            <Text style={styles.rightMeta}>
              Invoice date: {formatDisplayDate(invoice.invoiceDate)}
            </Text>
            {invoice.dueDate ? (
              <Text style={styles.rightMeta}>
                Due date: {formatDisplayDate(invoice.dueDate)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.textLine}>{invoice.customer?.name ?? "Customer"}</Text>
          {invoice.customer?.phoneNumber ? (
            <Text style={styles.textLine}>
              {formatPhone(invoice.customer.phoneNumber) ?? invoice.customer.phoneNumber}
            </Text>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, styles.skuCell]}>Item</Text>
            <Text style={[styles.cell, styles.descCell]}>Description</Text>
            <Text style={[styles.cell, styles.qtyCell]}>Cases</Text>
            <Text style={[styles.cell, styles.weightCell]}>Weight lbs</Text>
            <Text style={[styles.cell, styles.unitCell]}>Unit price</Text>
            <Text style={[styles.cell, styles.totalCell]}>Amount</Text>
          </View>
          {(invoice.lines ?? []).map(line => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.skuCell]}>
                {line.product?.sku ?? "-"}
              </Text>
              <Text style={[styles.cell, styles.descCell]}>
                {line.product?.name ?? "Product"}
              </Text>
              <Text style={[styles.cell, styles.qtyCell]}>
                {String(line.quantityCases ?? 0)}
              </Text>
              <Text style={[styles.cell, styles.weightCell]}>
                {toNumber(line.billedWeightLbs).toFixed(2)}
              </Text>
              <Text style={[styles.cell, styles.unitCell]}>
                {formatMoney(line.unitPrice)}
              </Text>
              <Text style={[styles.cell, styles.totalCell]}>
                {formatMoney(line.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{formatMoney(invoice.subtotal)}</Text>
          </View>
          {toNumber(invoice.discountAmount) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text>-{formatMoney(invoice.discountAmount)}</Text>
            </View>
          ) : null}
          {toNumber(invoice.creditAmount) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Credit</Text>
              <Text>-{formatMoney(invoice.creditAmount)}</Text>
            </View>
          ) : null}
          {toNumber(invoice.fuelSurchargeAmount) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Fuel surcharge</Text>
              <Text>{formatMoney(invoice.fuelSurchargeAmount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsStrong}>Total</Text>
            <Text style={styles.totalsStrong}>{formatMoney(invoice.totalAmount)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>COGS</Text>
            <Text>{formatMoney(totalCogs)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Gross profit</Text>
            <Text>{formatMoney(grossProfit)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Margin</Text>
            <Text>{marginPercent.toFixed(1)}%</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function getSalesInvoicePdfFilename(invoice: SalesInvoiceDetail) {
  return safePdfFilename(invoice.invoiceNumber);
}

export async function renderSalesInvoicePdf(args: {
  companyName: string;
  invoice: SalesInvoiceDetail;
}) {
  return renderToBuffer(<InvoicePdfDocument {...args} />);
}
