"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  suppliers,
  supplierInvoices,
  supplierInvoiceLines,
  supplierProductAliases,
  tenants,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { validatePdfUpload } from "@/lib/file-validation";
import {
  applyRateLimit,
  rateLimiters,
  RateLimitError,
} from "@/lib/rate-limit";
import { isPlatformAdminAuthUser } from "@/lib/platform-admin";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { normalizeProductName } from "../utils/normalization";

import {
  completeSupplierInvoice,
  createSupplierInvoice,
  deleteSupplierInvoice,
  getSupplierInvoiceById,
  getSupplierInvoices,
  getSupplierInvoicesPage,
  recordSupplierInvoicePayment,
  removeSupplierInvoiceAttachment,
  reverseSupplierInvoice,
  updateSupplierInvoice,
  uploadSupplierInvoiceAttachment,
} from "../services/receiving";
import { parseSupplierInvoicePdf } from "../services/pdf-prefill";
import {
  getImportProfilesForSupplier,
  createImportProfile,
  updateImportProfile,
  deactivateImportProfile,
  type CreateImportProfileInput,
  type UpdateImportProfileInput,
} from "../services/import-profiles";
import {
  getAliasesForSupplier,
  getAllAliasesForTenant,
  upsertProductAlias,
  confirmProductAlias,
  deleteProductAlias,
  saveConfirmedAiAlias,
  recordManualProductSelection,
  type CreateAliasInput,
  type UpdateAliasInput,
} from "../services/product-matching";

export async function getSupplierInvoicesAction() {
  return await getSupplierInvoices();
}

export async function getSupplierInvoicesPageAction(
  input?: Parameters<typeof getSupplierInvoicesPage>[0],
) {
  return await getSupplierInvoicesPage(input);
}

export async function getSupplierInvoiceByIdAction(id: string) {
  return await getSupplierInvoiceById(id);
}

export async function createSupplierInvoiceAction(
  input: Parameters<typeof createSupplierInvoice>[0],
) {
  return await createSupplierInvoice(input);
}

export async function updateSupplierInvoiceAction(
  input: Parameters<typeof updateSupplierInvoice>[0],
) {
  return await updateSupplierInvoice(input);
}

export async function completeSupplierInvoiceAction(
  input: Parameters<typeof completeSupplierInvoice>[0],
) {
  return await completeSupplierInvoice(input);
}

export async function reverseSupplierInvoiceAction(
  input: Parameters<typeof reverseSupplierInvoice>[0],
) {
  return await reverseSupplierInvoice(input);
}

export async function recordSupplierInvoicePaymentAction(
  input: Parameters<typeof recordSupplierInvoicePayment>[0],
) {
  return await recordSupplierInvoicePayment(input);
}

export async function deleteSupplierInvoiceAction(id: string) {
  return await deleteSupplierInvoice(id);
}

export async function parseSupplierInvoicePdfAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing PDF file.");
  }
  // Cheap CPU check first — reject malformed uploads before hitting Redis.
  const validation = await validatePdfUpload(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  const user = await getCurrentPortalUser();
  if (!(await isPlatformAdminAuthUser(user.authUserId))) {
    const [userResult, tenantResult] = await Promise.all([
      applyRateLimit(rateLimiters.pdfParse, `user:${user.id}`),
      applyRateLimit(rateLimiters.pdfParseTenant, `tenant:${user.tenantId}`),
    ]);
    if (!userResult.success) {
      throw new RateLimitError(userResult.retryAfterSeconds);
    }
    if (!tenantResult.success) {
      throw new RateLimitError(tenantResult.retryAfterSeconds);
    }
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return await parseSupplierInvoicePdf({
    originalFilename: validation.safeName,
    mimeType: file.type || null,
    bytes,
  });
}

export async function uploadSupplierInvoiceAttachmentAction(
  formData: FormData,
): Promise<{ fileId: string }> {
  const supplierInvoiceId = formData.get("supplierInvoiceId");
  const file = formData.get("file");
  if (typeof supplierInvoiceId !== "string" || !supplierInvoiceId) {
    throw new Error("Missing supplierInvoiceId.");
  }
  if (!(file instanceof File)) {
    throw new Error("Missing file.");
  }
  const validation = await validatePdfUpload(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return await uploadSupplierInvoiceAttachment({
    supplierInvoiceId,
    originalFilename: validation.safeName,
    mimeType: file.type || null,
    bytes,
  });
}

export async function removeSupplierInvoiceAttachmentAction(input: {
  supplierInvoiceId: string;
  fileId: string;
}) {
  return await removeSupplierInvoiceAttachment(input);
}

// ---------------------------------------------------------------------------
// Import profile actions
// ---------------------------------------------------------------------------

export async function getImportProfilesForSupplierAction(supplierId: string) {
  return await getImportProfilesForSupplier(supplierId);
}

export async function createImportProfileAction(input: CreateImportProfileInput) {
  return await createImportProfile(input);
}

export async function updateImportProfileAction(input: UpdateImportProfileInput) {
  return await updateImportProfile(input);
}

export async function deactivateImportProfileAction(id: string) {
  return await deactivateImportProfile(id);
}

// ---------------------------------------------------------------------------
// Product alias actions
// ---------------------------------------------------------------------------

export async function getAliasesForSupplierAction(supplierId: string) {
  return await getAliasesForSupplier(supplierId);
}

export async function getAllAliasesForTenantAction() {
  return await getAllAliasesForTenant();
}

export async function upsertProductAliasAction(input: CreateAliasInput) {
  return await upsertProductAlias(input);
}

export async function confirmProductAliasAction(aliasId: string) {
  return await confirmProductAlias(aliasId);
}

export async function deleteProductAliasAction(aliasId: string) {
  return await deleteProductAlias(aliasId);
}

export async function saveConfirmedAiAliasAction(args: {
  supplierId: string;
  vendorProductName: string;
  internalProductId: string;
}) {
  return await saveConfirmedAiAlias(args);
}

export async function recordManualProductSelectionAction(args: {
  supplierId: string;
  vendorProductName: string;
  internalProductId: string;
}) {
  return await recordManualProductSelection(args);
}

export async function saveImportAliasesBatchAction(
  aliases: Array<{
    supplierId: string;
    vendorProductName: string;
    internalProductId: string;
  }>,
): Promise<void> {
  if (aliases.length === 0) return;
  await Promise.allSettled(
    aliases.map(a =>
      upsertProductAlias({
        supplierId: a.supplierId,
        vendorProductName: a.vendorProductName,
        internalProductId: a.internalProductId,
        confidence: 100,
        source: "confirmed",
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// First-bill mode: create products + aliases + supplier + invoice atomically
// ---------------------------------------------------------------------------

type FirstBillLine = {
  rawVendorText: string;
  userProductName: string;
  quantityCases: number;
  weightLbs: string;
  unitPrice: string;
  unitType: "catch_weight" | "fixed_case";
};

function generateSku(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug || "prod"}-${suffix}`;
}

function computeLineTotal(line: FirstBillLine): string {
  if (line.unitType === "catch_weight") {
    return (Number(line.weightLbs) * Number(line.unitPrice)).toFixed(2);
  }
  return (line.quantityCases * Number(line.unitPrice)).toFixed(2);
}

export async function saveFirstBillAction(input: {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  receiveDate: string;
  asDraft: boolean;
  lines: FirstBillLine[];
}): Promise<{ invoiceId: string }> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  if (input.lines.length === 0) throw new Error("At least one line is required.");
  if (!input.supplierName.trim()) throw new Error("Supplier name is required.");

  const invoiceId = await db.transaction(async tx => {
    // 1. Upsert supplier
    const [supplier] = await tx
      .insert(suppliers)
      .values({
        tenantId: tenant.id,
        name: input.supplierName,
        createdByUserId: currentUser.id,
        updatedByUserId: currentUser.id,
      })
      .onConflictDoUpdate({
        target: [suppliers.tenantId, suppliers.name],
        set: { updatedByUserId: currentUser.id },
      })
      .returning({ id: suppliers.id });

    // 2. Create products + aliases (serial to avoid SKU races)
    const lineProductIds: string[] = [];
    for (const line of input.lines) {
      const [product] = await tx
        .insert(products)
        .values({
          tenantId: tenant.id,
          sku: generateSku(line.userProductName),
          name: line.userProductName,
          defaultPricePerLb: "0",
          createdByUserId: currentUser.id,
          updatedByUserId: currentUser.id,
        })
        .returning({ id: products.id });

      await tx
        .insert(supplierProductAliases)
        .values({
          tenantId: tenant.id,
          supplierId: supplier.id,
          vendorProductName: line.rawVendorText,
          normalizedVendorProductName: normalizeProductName(line.rawVendorText),
          internalProductId: product.id,
          confidence: "100",
          source: "confirmed",
          createdByUserId: currentUser.id,
        })
        .onConflictDoUpdate({
          target: [
            supplierProductAliases.tenantId,
            supplierProductAliases.supplierId,
            supplierProductAliases.normalizedVendorProductName,
          ],
          set: { internalProductId: product.id, confidence: "100" },
        });

      lineProductIds.push(product.id);
    }

    // 3. Create invoice
    const totalAmount = input.lines
      .reduce((sum, l) => sum + Number(computeLineTotal(l)), 0)
      .toFixed(2);

    const [invoice] = await tx
      .insert(supplierInvoices)
      .values({
        tenantId: tenant.id,
        supplierId: supplier.id,
        invoiceNumber: input.invoiceNumber || "BILL-1",
        invoiceDate: input.invoiceDate,
        receiveDate: input.receiveDate,
        status: "draft",
        totalAmount,
        createdByUserId: currentUser.id,
        updatedByUserId: currentUser.id,
      })
      .returning({ id: supplierInvoices.id });

    await tx.insert(supplierInvoiceLines).values(
      input.lines.map((line, i) => ({
        supplierInvoiceId: invoice.id,
        productId: lineProductIds[i],
        unitType: line.unitType,
        quantityCases: line.quantityCases,
        weightLbs: line.weightLbs,
        unitPrice: line.unitPrice,
        lineTotal: computeLineTotal(line),
        caseWeightsLbs: null,
      })),
    );

    // 4. Increment org bill_count so subsequent PDFs use steady-state mode
    await tx
      .update(tenants)
      .set({ billCount: sql`${tenants.billCount} + 1`, welcomeSkippedAt: sql`COALESCE(${tenants.welcomeSkippedAt}, NOW())` })
      .where(eq(tenants.id, tenant.id));

    return invoice.id;
  });

  return { invoiceId };
}
