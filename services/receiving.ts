import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryItems,
  lotReceipts,
  lots,
  supplierInvoiceLines,
  supplierInvoices,
} from "@/db/schema";

function makeBarcode(lotNumber: string, index: number) {
  return `${lotNumber}-BOX-${String(index).padStart(4, "0")}`;
}

export async function createSupplierInvoice(input: {
  supplierId: number;
  createdByUserId: number;
  invoiceNumber: string;
  invoiceDate: string;
  paymentMethod?: "cash" | "zelle" | "check" | "credit_card" | "ach";
  notes?: string;
  lines: Array<{
    productId: number;
    quantityCases: number;
    weightLbs: string;
    unitType?: "catch_weight" | "case" | "packet";
    unitPrice: string;
    lineTotal: string;
  }>;
}) {
  const totalAmount = input.lines.reduce(
    (sum, line) => sum + Number(line.lineTotal),
    0,
  );

  const [invoice] = await db
    .insert(supplierInvoices)
    .values({
      supplierId: input.supplierId,
      createdByUserId: input.createdByUserId,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      totalAmount: totalAmount.toFixed(4),
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    })
    .returning();

  const createdLines = [];
  for (const line of input.lines) {
    const [createdLine] = await db
      .insert(supplierInvoiceLines)
      .values({
        supplierInvoiceId: invoice.id,
        productId: line.productId,
        quantityCases: line.quantityCases,
        weightLbs: line.weightLbs,
        unitType: line.unitType ?? "catch_weight",
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })
      .returning();

    createdLines.push(createdLine);
  }

  return {
    invoice,
    lines: createdLines,
  };
}

export async function receiveLot(input: {
  supplierId: number;
  supplierInvoiceLineId: number;
  lotNumber: string;
  receiveDate: string;
  expirationDate: string;
  boxes: Array<{
    exactWeightLbs: string;
    cases?: number;
  }>;
}) {
  const supplierLine = await db.query.supplierInvoiceLines.findFirst({
    where: eq(supplierInvoiceLines.id, input.supplierInvoiceLineId),
  });

  if (!supplierLine) {
    throw new Error("Supplier invoice line not found");
  }

  const [lot] = await db
    .insert(lots)
    .values({
      lotNumber: input.lotNumber,
      supplierId: input.supplierId,
      receiveDate: input.receiveDate,
      expirationDate: input.expirationDate,
    })
    .returning();

  const totalWeight = input.boxes.reduce(
    (sum, box) => sum + Number(box.exactWeightLbs),
    0,
  );

  await db.insert(lotReceipts).values({
    lotId: lot.id,
    supplierInvoiceLineId: input.supplierInvoiceLineId,
    receivedCases: input.boxes.reduce((sum, box) => sum + (box.cases ?? 1), 0),
    receivedWeightLbs: totalWeight.toFixed(4),
  });

  const createdItems = [];
  for (let i = 0; i < input.boxes.length; i++) {
    const box = input.boxes[i];
    const [item] = await db
      .insert(inventoryItems)
      .values({
        productId: supplierLine.productId,
        lotId: lot.id,
        barcodeId: makeBarcode(input.lotNumber, i + 1),
        exactWeightLbs: box.exactWeightLbs,
        cases: box.cases ?? 1,
        status: "in_stock",
      })
      .returning();

    createdItems.push(item);
  }

  return {
    lot,
    inventoryItems: createdItems,
  };
}
