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
import { logAuditEvent } from "@/lib/audit-log";
import { validatePdfUpload } from "@/lib/file-validation";
import { captureServerEvent } from "@/lib/posthog-server";
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
  generateSupplierInvoiceReferenceNumber,
  getReversalPreview,
  getSupplierInvoiceById,
  getSupplierInvoiceCostDiffContext,
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
  bulkImportSupplierInvoices,
  BULK_IMPORT_MAX_FILES,
  type BulkImportFileInput,
  type BulkImportResult,
} from "../services/bulk-import";
import {
  getBulkImportFile,
  getBulkImportPdfSignedUrl,
  getSupplierPerformanceStats,
  listPendingBulkImportFiles,
  markBulkImportFileReviewed,
  restoreBulkImportFile,
  softDeleteBulkImportFile,
  type BulkImportFileRow,
  type SupplierPerformanceStats,
} from "../services/bulk-import-history";
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
  const user = await getCurrentPortalUser();
  const result = await createSupplierInvoice(input);
  await captureServerEvent({
    userId: user.id,
    tenantId: user.tenantId,
    event: "bill.saved",
    properties: {
      line_count: input.lines?.length ?? 0,
    },
  });
  return result;
}

export async function updateSupplierInvoiceAction(
  input: Parameters<typeof updateSupplierInvoice>[0],
) {
  return await updateSupplierInvoice(input);
}

export async function completeSupplierInvoiceAction(
  input: Parameters<typeof completeSupplierInvoice>[0],
) {
  const user = await getCurrentPortalUser();
  const result = await completeSupplierInvoice(input);
  await captureServerEvent({
    userId: user.id,
    tenantId: user.tenantId,
    event: "bill.received",
    properties: {
      bill_id: input.id,
      line_override_count: input.lineOverrides?.length ?? 0,
    },
  });
  return result;
}

export async function reverseSupplierInvoiceAction(
  input: Parameters<typeof reverseSupplierInvoice>[0],
) {
  return await reverseSupplierInvoice(input);
}

export async function getSupplierInvoiceCostDiffContextAction(
  input: Parameters<typeof getSupplierInvoiceCostDiffContext>[0],
) {
  return await getSupplierInvoiceCostDiffContext(input);
}

export async function getReversalPreviewAction(invoiceId: string) {
  return await getReversalPreview(invoiceId);
}

export async function recordSupplierInvoicePaymentAction(
  input: Parameters<typeof recordSupplierInvoicePayment>[0],
) {
  const user = await getCurrentPortalUser();
  const result = await recordSupplierInvoicePayment(input);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "bill.mark_paid_manually",
    resourceType: "supplier_invoice",
    resourceId: input.supplierInvoiceId,
    metadata: { amount: input.amount, paymentDate: input.paymentDate },
  });
  return result;
}

export async function deleteSupplierInvoiceAction(id: string) {
  const [user, invoice] = await Promise.all([
    getCurrentPortalUser(),
    getSupplierInvoiceById(id),
  ]);
  const result = await deleteSupplierInvoice(id);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "bill.delete",
    resourceType: "supplier_invoice",
    resourceId: id,
    metadata: invoice
      ? {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          invoiceDate: invoice.invoiceDate,
        }
      : {},
  });
  return result;
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
  const startedAt = Date.now();
  const result = await parseSupplierInvoicePdf({
    originalFilename: validation.safeName,
    mimeType: file.type || null,
    bytes,
  });
  await captureServerEvent({
    userId: user.id,
    tenantId: user.tenantId,
    event: "pdf.parsed",
    properties: {
      line_count: result.prefillResult.values.lines.length,
      duration_ms: Date.now() - startedAt,
      ai_used: result.aiUsed,
      vision_used: result.visionUsed,
      first_bill_mode: Boolean(result.firstBillLines),
      parse_mode: result.telemetry?.mode ?? null,
      text_extractor: result.telemetry?.textExtractor ?? null,
      text_char_count: result.telemetry?.textCharCount ?? null,
    },
  });
  return result;
}

export async function bulkImportSupplierInvoicesAction(
  formData: FormData,
): Promise<BulkImportResult> {
  // Each file is appended under the same key "file"; collect them in order.
  const rawFiles = formData.getAll("file");
  const files: File[] = [];
  for (const f of rawFiles) {
    if (f instanceof File && f.size > 0) files.push(f);
  }
  if (files.length === 0) {
    throw new Error("Pick at least one PDF to import.");
  }
  if (files.length > BULK_IMPORT_MAX_FILES) {
    throw new Error(
      `At most ${BULK_IMPORT_MAX_FILES} PDFs can be imported in one batch.`,
    );
  }

  // Validate every file upfront so we don't burn rate-limit tokens on bad
  // uploads. validatePdfUpload checks MIME, magic bytes, and size caps.
  const validations = await Promise.all(files.map(f => validatePdfUpload(f)));
  const safeNames: string[] = [];
  for (let i = 0; i < validations.length; i++) {
    const v = validations[i];
    if (!v.ok) {
      throw new Error(`${files[i].name}: ${v.error}`);
    }
    safeNames.push(v.safeName);
  }

  const user = await getCurrentPortalUser();

  // Rate-limit each file. Platform admins skip — keeps internal tooling
  // unconstrained. Drawing per-file keeps cost-per-import predictable; if
  // the budget runs out mid-batch we bail before the expensive parse work.
  if (!(await isPlatformAdminAuthUser(user.authUserId))) {
    for (let i = 0; i < files.length; i++) {
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
  }

  // Materialise file bytes once so the bulk service can pass them through
  // the parse pipeline without re-reading the FormData stream.
  const inputs: BulkImportFileInput[] = await Promise.all(
    files.map(async (file, i) => ({
      originalFilename: safeNames[i],
      mimeType: file.type || null,
      bytes: Buffer.from(await file.arrayBuffer()),
    })),
  );

  const startedAt = Date.now();
  // Phase A dual-write: bulkImportSupplierInvoices now also persists each
  // parsed file to R2 + the bulk_import_files table. The client still gets
  // the full PipelineResult per item so the existing localStorage handoff
  // continues to work; PR A2 will switch the client to read from the server.
  const tenant = await getCurrentTenant();
  const result = await bulkImportSupplierInvoices(inputs, {
    tenantId: tenant.id,
    uploadedByUserId: user.id,
  });

  // Aggregate per-file parse telemetry — handy for spotting batches where
  // PARSE_MODE=text-first stayed entirely on the fast path vs. falling back
  // to pdf-parse / vision for some subset of the upload.
  const parsedItems = result.items.flatMap(item =>
    item.status === "parsed" ? [item.pipelineResult] : [],
  );
  const visionCount = parsedItems.filter(p => p.visionUsed).length;
  const pdfjsCount = parsedItems.filter(
    p => p.telemetry?.textExtractor === "pdfjs-dist",
  ).length;
  const parseMode = parsedItems[0]?.telemetry?.mode ?? null;

  await captureServerEvent({
    userId: user.id,
    tenantId: user.tenantId,
    event: "bulk_import.processed",
    properties: {
      file_count: result.summary.total,
      parsed_count: result.summary.parsed,
      errored_count: result.summary.errored,
      duration_ms: Date.now() - startedAt,
      parse_mode: parseMode,
      pdfjs_extractor_count: pdfjsCount,
      vision_used_count: visionCount,
    },
  });
  return result;
}

// ---------------------------------------------------------------------------
// Bulk-import history actions — server-backed reads + writes that replace
// the prior localStorage handoff. The client uses these to drive the
// bulk-landing screen, the review queue carousel, and the per-file PDF
// preview without writing anything to localStorage / IndexedDB.
// ---------------------------------------------------------------------------

export async function listPendingBulkImportFilesAction(): Promise<
  BulkImportFileRow[]
> {
  return await listPendingBulkImportFiles();
}

export async function getBulkImportFileAction(
  id: string,
): Promise<BulkImportFileRow | null> {
  return await getBulkImportFile(id);
}

export async function markBulkImportFileReviewedAction(args: {
  id: string;
  supplierInvoiceId: string;
}): Promise<void> {
  return await markBulkImportFileReviewed(args);
}

export async function getBulkImportPdfSignedUrlAction(
  id: string,
): Promise<string | null> {
  return await getBulkImportPdfSignedUrl(id);
}

/**
 * Soft-delete a bulk-import row. Pairs with `restoreBulkImportFileAction`
 * for the bulk-landing Undo affordance. The R2 object is retained on
 * delete; recovery is just clearing `deleted_at`.
 */
export async function softDeleteBulkImportFileAction(
  id: string,
): Promise<void> {
  return await softDeleteBulkImportFile(id);
}

/**
 * Coarse supplier-performance buckets for the queue-card badge. Returns one
 * row per requested supplier id, including `red` for brand-new vendors so
 * the UI doesn't have to distinguish "unknown" from "zero bills".
 */
export async function getSupplierPerformanceStatsAction(
  supplierIds: string[],
): Promise<SupplierPerformanceStats[]> {
  return await getSupplierPerformanceStats(supplierIds);
}

export async function restoreBulkImportFileAction(id: string): Promise<void> {
  return await restoreBulkImportFile(id);
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

    const referenceNumber = await generateSupplierInvoiceReferenceNumber(tx, tenant.id);
    const [invoice] = await tx
      .insert(supplierInvoices)
      .values({
        tenantId: tenant.id,
        supplierId: supplier.id,
        referenceNumber,
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

  await captureServerEvent({
    userId: currentUser.id,
    tenantId: tenant.id,
    event: "first_bill.saved",
    properties: {
      line_count: input.lines.length,
      as_draft: input.asDraft,
    },
  });

  return { invoiceId };
}
