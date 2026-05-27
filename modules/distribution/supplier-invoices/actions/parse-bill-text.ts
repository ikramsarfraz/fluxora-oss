"use server";

import { z } from "zod";

import { requireFeature } from "@/modules/core/feature-flags";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { AI_ASSISTED_ENTRY_FEATURE } from "@/modules/distribution/orders/feature";
import { isPlatformAdminAuthUser } from "@/lib/platform-admin";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  applyRateLimit,
  rateLimiters,
  RateLimitError,
} from "@/lib/rate-limit";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { recordAiUsageEvents } from "../services/ai-usage-events";
import { runParsingPipeline } from "../services/parsing-pipeline";

// ---------------------------------------------------------------------------
// Paste-text parse for `/supplier-invoices/new`.
//
// Reuses the *same* parsing pipeline that the PDF upload flow uses — the
// pipeline already accepts arbitrary `extractedText` as input and emits a
// `PipelineResult` the form's `seedFromPipelineResult` knows how to consume.
// We just call it with no PDF bytes and a page count of 0 so the vision /
// scanned-PDF branches stay off.
//
// Gated by `AI_ASSISTED_ENTRY_FEATURE` — the same flag controls the parallel
// `/orders/new` paste surface, so one tenant toggle enables both at once.
// Re-using the flag from the orders module is intentional: cross-domain
// import of a constant, not behaviour.
// ---------------------------------------------------------------------------

const parseBillTextInputSchema = z.object({
  rawText: z
    .string()
    .min(20, "Message is too short to parse as a bill.")
    .max(30_000, "Message is too long (30K chars max)."),
});

export type ParseBillTextInput = z.infer<typeof parseBillTextInputSchema>;

export async function parseBillTextAction(input: ParseBillTextInput) {
  const parsed = parseBillTextInputSchema.parse(input);
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, AI_ASSISTED_ENTRY_FEATURE);
  const user = await getCurrentPortalUser();

  // Same rate-limit pair as the PDF parse path — paste-text has the same
  // cost profile (one AI extraction call + product matching) so the same
  // per-user + per-tenant budgets apply.
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

  // pdfPageCount=0 + no pdfBytes → no scanned-PDF fast-fail, no vision
  // dispatch. The pipeline still runs AI extraction + supplier lookup +
  // product matching + fee detection over the raw text, which is exactly
  // what the PDF path does post-OCR.
  const startedAt = Date.now();
  const result = await runParsingPipeline({
    extractedText: parsed.rawText,
    sourceFilename: "pasted-message.txt",
    tenantId: tenant.id,
    pdfPageCount: 0,
  });

  // Cost tracking — same shape as parseSupplierInvoicePdfAction so the
  // platform-admin cost dashboard rolls up text-paste alongside PDF parses.
  await recordAiUsageEvents({
    tenantId: user.tenantId,
    portalUserId: user.id,
    sourceBulkImportFileId: null,
    sourceFilename: "pasted-message.txt",
    events: result.usageEvents,
  });

  await captureServerEvent({
    userId: user.id,
    tenantId: user.tenantId,
    event: "bill.paste_parsed",
    properties: {
      line_count: result.prefillResult.values.lines.length,
      duration_ms: Date.now() - startedAt,
      ai_used: result.aiUsed,
      char_count: parsed.rawText.length,
    },
  });

  return result;
}
