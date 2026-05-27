"use server";

import { canManageExpenses } from "@/lib/expenses/metadata";
import { sanitizeFilename } from "@/lib/file-validation";
import { isPlatformAdminAuthUser } from "@/lib/platform-admin";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  RateLimitError,
  applyRateLimit,
  rateLimiters,
} from "@/lib/rate-limit";
import {
  getCurrentPortalUser,
  type PortalUserRole,
} from "@/modules/shared/services/portal-users";

import {
  extractReceiptFromUpload,
  recordReceiptUsage,
  type ReceiptExtractionResult,
} from "../services/receipt-extraction";

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches expense_attachments cap.

export type ParseExpenseReceiptResult = {
  vendorName: string | null;
  transactionDate: string | null;
  totalAmount: string | null;
  currency: string | null;
  paymentMethodHint: ReceiptExtractionResult["paymentMethodHint"];
  confidence: number;
  status: ReceiptExtractionResult["status"];
  errorCode: ReceiptExtractionResult["errorCode"];
  errorMessage: ReceiptExtractionResult["errorMessage"];
  /** Safe (sanitized) filename echoed back so the form can attach the same
   *  file on submit without re-deriving the name client-side. */
  safeFilename: string;
};

/**
 * Read a receipt file from FormData, run vision extraction, and return prefill
 * fields the expense form uses to seed itself. The file itself is NOT stored
 * server-side here — the form attaches it via `uploadExpenseAttachmentAction`
 * after the expense row is created. Keeping these two server actions
 * orthogonal means a parse failure doesn't leave an orphaned R2 object.
 */
export async function parseExpenseReceiptAction(
  formData: FormData,
): Promise<ParseExpenseReceiptResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing receipt file.");
  }
  if (file.size === 0) {
    throw new Error("Receipt file is empty.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Receipt is too large (max ${MAX_BYTES / (1024 * 1024)} MB).`);
  }
  const mimeType = (file.type || "").toLowerCase();
  if (!ACCEPTED_MIME.has(mimeType)) {
    throw new Error(
      `Unsupported file type "${mimeType || "unknown"}". Upload a JPEG, PNG, WebP, or PDF.`,
    );
  }
  const safeName = sanitizeFilename(file.name);
  if (!safeName) {
    throw new Error("Filename contains invalid characters.");
  }

  const user = await getCurrentPortalUser();
  if (!canManageExpenses(user.role as PortalUserRole)) {
    throw new Error("Your role does not allow creating expenses.");
  }

  // Reuse the pdf-parse rate limiter — receipts run the same cost surface
  // (OpenAI vision call). Platform admins skip to keep internal tooling
  // unconstrained, mirroring the bill flow.
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
  const result = await extractReceiptFromUpload({
    bytes,
    mimeType,
    filename: safeName,
  });

  await captureServerEvent({
    userId: user.id,
    tenantId: user.tenantId,
    event: "expense_receipt.parsed",
    properties: {
      duration_ms: Date.now() - startedAt,
      status: result.status,
      error_code: result.errorCode,
      confidence: result.confidence,
      has_vendor: result.vendorName != null,
      has_date: result.transactionDate != null,
      has_total: result.totalAmount != null,
      mime_type: mimeType,
    },
  });

  await recordReceiptUsage({
    tenantId: user.tenantId,
    portalUserId: user.id,
    sourceFilename: safeName,
    result,
  });

  return {
    vendorName: result.vendorName,
    transactionDate: result.transactionDate,
    totalAmount: result.totalAmount,
    currency: result.currency,
    paymentMethodHint: result.paymentMethodHint,
    confidence: result.confidence,
    status: result.status,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    safeFilename: safeName,
  };
}
