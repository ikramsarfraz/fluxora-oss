import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { MonthlyReport } from "@/lib/api";
import { formatMoney } from "./currency";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    fleet_maintenance: "Fleet maintenance",
    gas: "Gas",
    rent: "Rent",
    insurance: "Insurance",
    utilities: "Utilities",
    supplies: "Supplies",
    other: "Other",
  };
  return map[category] ?? category;
}

function paymentMethodLabel(method: string | null): string {
  if (!method) return "—";
  const map: Record<string, string> = {
    cash: "Cash",
    zelle: "Zelle",
    check: "Check",
    credit_card: "Credit card",
  };
  return map[method] ?? method;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function buildMonthlyReportPdf(report: MonthlyReport): jsPDF {
  const doc = new jsPDF();
  const leftX = 14;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Monthly Report", leftX, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`${MONTHS[report.month - 1]} ${report.year}`, leftX, y);
  y += 14;

  // --- Expenses ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Expenses", leftX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Total: ${formatMoney(report.expenses.total_amount)} (${report.expenses.count} ${report.expenses.count === 1 ? "entry" : "entries"})`,
    leftX,
    y
  );
  y += 8;

  if (report.expenses.by_category.length > 0) {
    const expenseRows = report.expenses.by_category.map((row) => [
      categoryLabel(row.category),
      formatMoney(row.total_amount),
      String(row.count),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Category", "Amount", "Count"]],
      body: expenseRows,
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 66, 66], textColor: 255 },
    });
    y = ((doc as unknown) as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  }
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("All expenses (detail)", leftX, y);
  y += 6;
  if (report.expenses.detail.length > 0) {
    const detailRows = report.expenses.detail.map((row) => [
      formatDate(row.expense_date),
      categoryLabel(row.category),
      formatMoney(row.amount),
      (row.note ?? "—").slice(0, 30),
      paymentMethodLabel(row.payment_method),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Date", "Category", "Amount", "Note", "Payment method"]],
      body: detailRows,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
      margin: { left: leftX },
    });
    y = ((doc as unknown) as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  }
  y += 12;

  // --- Sales ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Sales", leftX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Total revenue: ${formatMoney(report.sales.total_revenue)} (${report.sales.count} invoice${report.sales.count === 1 ? "" : "s"})`,
    leftX,
    y
  );
  y += 8;
  if (report.sales.detail.length > 0) {
    const salesRows = report.sales.detail.map((row) => [
      row.order_number ?? `#${row.order_id}`,
      formatDate(row.order_date),
      row.customer_name.slice(0, 20),
      formatMoney(row.total_amount),
      formatMoney(row.amount_paid),
      paymentMethodLabel(row.payment_method),
      row.check_number ?? "—",
      row.paid ? "Yes" : "No",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Order #", "Date", "Customer", "Total", "Amt paid", "Payment", "Check #", "Paid"]],
      body: salesRows,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
      margin: { left: leftX },
    });
    y = ((doc as unknown) as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  }
  y += 12;

  // --- Purchases ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Purchases", leftX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Total: ${formatMoney(report.purchases.total_amount)} (${report.purchases.count} supplier invoice${report.purchases.count === 1 ? "" : "s"})`,
    leftX,
    y
  );
  y += 8;
  if (report.purchases.detail.length > 0) {
    const purchaseRows = report.purchases.detail.map((row) => [
      row.supplier_name.slice(0, 18),
      row.invoice_number,
      formatDate(row.invoice_date),
      formatMoney(row.total_amount),
      formatMoney(row.amount_paid),
      paymentMethodLabel(row.payment_method),
      formatMoney(row.outstanding),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Supplier", "Invoice #", "Date", "Total", "Paid", "Payment", "Outstanding"]],
      body: purchaseRows,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
      margin: { left: leftX },
    });
  }

  return doc;
}

export function downloadMonthlyReportPdf(report: MonthlyReport): void {
  const doc = buildMonthlyReportPdf(report);
  const monthName = MONTHS[report.month - 1];
  const filename = `monthly-report-${monthName.toLowerCase().replace(/\s/g, "-")}-${report.year}.pdf`;
  doc.save(filename);
}

/** Return a blob URL for the report PDF to use in an iframe. Caller must revoke with URL.revokeObjectURL when done. */
export function getMonthlyReportPdfBlobUrl(report: MonthlyReport): string {
  const doc = buildMonthlyReportPdf(report);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}
