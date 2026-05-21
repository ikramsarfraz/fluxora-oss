"use client";

import { useMemo } from "react";

import { PageError } from "@/components/page-error";
import { PageLoading } from "@/components/page-loading";
import { useSupplierInvoice } from "../hooks/use-supplier-invoices";
import { inferWeightDraftState } from "@/modules/distribution/supplier-invoices/utils/case-weights";

import { SupplierInvoiceForm } from "./supplier-invoice-form";
import type {
  SupplierInvoiceChargeType,
  SupplierInvoiceFormValues,
} from "./supplier-invoice-form.schema";

export function SupplierInvoiceEditShell({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const { data: invoice, isLoading, error } = useSupplierInvoice(invoiceId);

  const initialValues = useMemo<SupplierInvoiceFormValues | undefined>(() => {
    if (!invoice) return undefined;
    return {
      supplierId: invoice.supplierId,
      supplierInvoiceNumber: invoice.invoiceNumber ?? "",
      invoiceDate: invoice.invoiceDate,
      receiveDate: invoice.receiveDate,
      paymentMethod: invoice.paymentMethod ?? null,
      notes: invoice.notes ?? "",
      lines: invoice.lines.map(line => ({
        ...inferWeightDraftState({
          unitType: line.unitType,
          quantityCases: line.quantityCases ?? 0,
          weightLbs: line.weightLbs ?? "0",
          caseWeightsLbs: line.caseWeightsLbs ?? null,
        }),
        id: line.id,
        productId: line.productId,
        unitType: line.unitType,
        quantityCases: String(line.quantityCases ?? 0),
        weightLbs: String(line.weightLbs ?? "0"),
        unitPrice: String(line.unitPrice ?? "0"),
        purchaseUnitAbbreviation:
          line.purchaseUnitAbbreviationSnapshot ?? "",
        lotNumberOverride: "",
        expirationDateOverride: "",
      })),
      charges: (invoice.charges ?? []).map(c => ({
        description: c.description,
        chargeType: (c.chargeType as SupplierInvoiceChargeType) ?? "other",
        rate: c.rate ? String(c.rate) : "",
        includeInInventoryCost: c.includeInInventoryCost ?? false,
        amount: String(c.amount ?? "0"),
      })),
    };
  }, [invoice]);

  if (isLoading || !initialValues) {
    return <PageLoading message="Loading invoice..." />;
  }
  if (error) {
    return <PageError message={(error as Error).message} />;
  }
  if (invoice && invoice.status !== "draft") {
    return (
      <PageError message="This invoice has already been completed and can no longer be edited." />
    );
  }

  return (
    <SupplierInvoiceForm
      mode="edit"
      invoiceId={invoiceId}
      initialValues={initialValues}
    />
  );
}
