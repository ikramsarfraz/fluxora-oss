import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice } from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { orderStatusLabel } from "@/lib/utils/status-labels";

const PRIME_LOGO_URL = "/prime-logo.png";

const toNumber = (raw: string | number | null | undefined): number => {
  const n = typeof raw === "string" ? parseFloat(raw) : raw ?? 0;
  return Number.isFinite(n as number) ? (n as number) : 0;
};

const formatWeight = (raw: string | number): string => {
  const n = toNumber(raw);
  return n.toFixed(2);
};

const formatPhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

/** Load logo and return as base64 data URL, or null if failed. */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(PRIME_LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildInvoicePdf(inv: Invoice): Promise<jsPDF> {
  const doc = new jsPDF();
  const isSalesOrder = !inv.order_number;
  const title = isSalesOrder ? "SALES ORDER" : "INVOICE";

  const leftX = 14;
  let logoAdded = false;
  try {
    const logoDataUrl = await loadLogoDataUrl();
    if (logoDataUrl) {
      const logoW = 45;
      const logoH = 14;
      doc.addImage(logoDataUrl, "PNG", leftX, 10, logoW, logoH);
      logoAdded = true;
    }
  } catch {
    // ignore logo errors
  }
  if (!logoAdded) {
    doc.setTextColor(17, 45, 78);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PRIME", leftX, 18);
    doc.setFontSize(11);
    doc.text("DISTRIBUTION LLC", leftX, 24);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const rightX = 140;
  doc.text(title, rightX, 16, { align: "left" });
  doc.text(
    isSalesOrder ? `Order # ${inv.order_id}` : `Invoice # ${inv.order_number ?? inv.order_id}`,
    rightX,
    22,
    { align: "left" }
  );
  doc.text(`Date: ${formatDisplayDate(inv.order_date)}`, rightX, 28, { align: "left" });
  if (inv.due_date) {
    doc.text(`Due date: ${formatDisplayDate(inv.due_date)}`, rightX, 34, { align: "left" });
  }

  let yPos = 32;
  doc.setFontSize(9);
  doc.text("Acme Distribution LLC", 14, yPos);
  doc.text("5508 Elmwood Ave Suite 403,", 14, yPos + 5);
  doc.text("Indianapolis, IN 46203", 14, yPos + 10);
  const companyPhone = formatPhone("3179671550") ?? "3179671550";
  doc.text(`Phone: ${companyPhone}`, 14, yPos + 15);
  doc.text("Email (Zelle): billing@example.com", 14, yPos + 20);

  yPos += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bill To", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  yPos += 6;
  doc.text(inv.customer_name, 14, yPos);
  yPos += 5;
  const hasAddress =
    inv.customer_street || inv.customer_city || inv.customer_state || inv.customer_zip;
  if (hasAddress) {
    const addrParts = [
      inv.customer_street,
      [inv.customer_city, inv.customer_state, inv.customer_zip].filter(Boolean).join(", "),
    ].filter(Boolean) as string[];
    addrParts.forEach((line) => {
      doc.text(line, 14, yPos);
      yPos += 5;
    });
  }
  if (inv.customer_phone) {
    const displayPhone = formatPhone(inv.customer_phone) ?? inv.customer_phone;
    doc.text(displayPhone, 14, yPos);
    yPos += 5;
  }

  doc.text(`Status: ${orderStatusLabel(inv.status)}`, 14, yPos + 6);

  const tableStartY = yPos + 16;

  const tableData = inv.lines.map((line) => {
    let description = line.product_name;
    if (line.unit_type === "catch_weight" && Array.isArray(line.case_weights) && line.case_weights.length > 0) {
      const weights = line.case_weights
        .map((w) => {
          const n = typeof w === "string" ? parseFloat(w) : Number(w);
          return Number.isFinite(n) ? n.toFixed(2) : String(w);
        })
        .join(", ");
      description = `${line.product_name} (boxes: ${weights} lbs)`;
    }
    return [
      line.product_sku,
      description,
      String(line.expected_cases),
      formatWeight(line.total_billed_weight_lbs),
      formatMoney(line.price_per_lb),
      formatMoney(line.line_total),
    ];
  });
  autoTable(doc, {
    startY: tableStartY,
    head: [["Item", "Description", "Cs / Pkt", "Weight (lbs)", "Rate/lb/cs/pkt", "Amount"]],
    body: tableData,
    theme: "striped",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [17, 45, 78], textColor: 255 },
  });

  const finalY =
    ((doc as unknown) as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    tableStartY;

  const totalsX = 130;
  const labelX = totalsX;
  const valueX = 180;
  let totalsY = finalY + 10;
  const subtotal = inv.subtotal ?? inv.total_amount;
  const discount = parseFloat(String(inv.discount_amount ?? 0)) || 0;
  const credit = parseFloat(String(inv.credit_amount ?? 0)) || 0;
  const creditLabel = inv.credit_type
    ? (inv.credit_type === "early_payment" ? "Credit (Early payment)" : inv.credit_type === "volume" ? "Credit (Volume)" : inv.credit_type === "promotional" ? "Credit (Promotional)" : inv.credit_type === "other" ? "Credit (Other)" : `Credit (${inv.credit_type})`)
    : "Credit";

  const fuelSurcharge = parseFloat(String((inv as { fuel_surcharge_amount?: string }).fuel_surcharge_amount ?? 0)) || 0;

  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", labelX, totalsY);
  doc.text(formatMoney(subtotal), valueX, totalsY, { align: "right" });
  totalsY += 6;
  if (discount > 0) {
    doc.text("Discount", labelX, totalsY);
    doc.text("-" + formatMoney(discount), valueX, totalsY, { align: "right" });
    totalsY += 6;
  }
  if (credit > 0) {
    doc.text(creditLabel, labelX, totalsY);
    doc.text("-" + formatMoney(credit), valueX, totalsY, { align: "right" });
    totalsY += 6;
  }
  if (fuelSurcharge > 0) {
    doc.text("Fuel surcharge", labelX, totalsY);
    doc.text(formatMoney(fuelSurcharge), valueX, totalsY, { align: "right" });
    totalsY += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Balance Due", labelX, totalsY);
  doc.text(formatMoney(inv.total_amount), valueX, totalsY, { align: "right" });

  const cardTotalWithFee = toNumber(inv.total_amount) * 1.03;
  const footerY = totalsY + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const notes = [
    "Check payable to Acme Distribution LLC.",
    `Credit card total (3% fee): ${formatMoney(cardTotalWithFee)}.`,
    "Zelle: billing@example.com (payment due at delivery).",
    "* Place weekly order by Sunday evening.",
    "* ALL MEAT PRODUCTS ARE 100% Zabiha (Hand-Slaughtered).",
    "* No claims allowed unless reported upon arrival of goods.",
    "* No merchandise may be returned without prior approval.",
    "* No deductions for any reason without prior approval.",
  ];
  notes.forEach((line, idx) => {
    doc.text(line, 14, footerY + idx * 4);
  });

  return doc;
}

/** Return a blob URL for the invoice PDF. Caller must revoke with URL.revokeObjectURL when done. */
export async function getInvoicePdfBlobUrl(inv: Invoice): Promise<string> {
  const doc = await buildInvoicePdf(inv);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

export async function downloadInvoicePdf(inv: Invoice, filename?: string): Promise<void> {
  const doc = await buildInvoicePdf(inv);
  const name = filename ?? (!inv.order_number ? `sales-order-${inv.order_id}.pdf` : `invoice-${inv.order_number}.pdf`);
  doc.save(name);
}
