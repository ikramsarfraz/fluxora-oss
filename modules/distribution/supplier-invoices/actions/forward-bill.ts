"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  billForwards,
  bulkImportFiles,
  supplierInvoices,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { captureServerEvent } from "@/lib/posthog-server";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { resend } from "@/lib/email";
import { downloadFile } from "@/lib/uploads/r2";
import {
  applyRateLimit,
  rateLimiters,
  RateLimitError,
} from "@/lib/rate-limit";
import { isPlatformAdminAuthUser } from "@/lib/platform-admin";
import { resolveOutboundFromAddress } from "@/lib/email-from-address";

export type ForwardBillInput = {
  supplierInvoiceId: string;
  recipients: string[];
  subject: string;
  messageBody: string;
  /**
   * @deprecated since multi-file picker landed. Now derived from
   * attachedFileIds.length > 0 and recorded on the bill_forwards row
   * for back-compat. Kept on the input so older clients still validate.
   */
  attachedOriginal: boolean;
  attachedSummary: boolean;
  /**
   * Namespaced file ids from BillPdfSource — `file:<uuid>` for a
   * manually-uploaded attachment, `bulk:<uuid>` for the bulk-import
   * original. Empty array sends body-only. Each id is validated below
   * against the invoice's actual sources before download.
   */
  attachedFileIds?: string[];
};

export async function forwardBillAction(input: ForwardBillInput) {
  const [user, tenant] = await Promise.all([
    getCurrentPortalUser(),
    getCurrentTenant(),
  ]);

  if (!(await isPlatformAdminAuthUser(user.authUserId))) {
    const result = await applyRateLimit(
      rateLimiters.emailForward,
      `tenant:${tenant.id}`,
    );
    if (!result.success) {
      throw new RateLimitError(result.retryAfterSeconds);
    }
  }

  const invoice = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, input.supplierInvoiceId),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    with: {
      attachments: {
        with: { file: true },
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      },
    },
  });

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "draft") throw new Error("Cannot forward draft bills");
  if (input.recipients.length === 0) throw new Error("At least one recipient required");
  if (input.recipients.length > 10) throw new Error("Maximum 10 recipients");

  // From + Reply-To resolution lives in resolveOutboundFromAddress so
  // the exact same logic powers the modal's helper text preview (via
  // checkBillPdfAvailability). Recipient + sender see identical
  // addresses to what the user just inspected.
  const fromResolved = resolveOutboundFromAddress(tenant, "bills");
  const fromAddress = fromResolved.header;
  const senderEmail = user.email ?? fromResolved.email;

  const htmlBody = input.messageBody
    .split("\n")
    .map(line => `<p style="margin: 0 0 8px;">${line || "&nbsp;"}</p>`)
    .join("");

  // Dev-only safety net: when EMAIL_FORWARD_OVERRIDE_TO is set, every
  // outbound goes to that single inbox instead of the user-typed
  // recipients. Lets a developer click "Forward" against a real
  // supplier bill without paging the actual supplier. The DB row +
  // audit log below STILL record `input.recipients` so the bill_forwards
  // history matches what a developer would see in production — the
  // override is purely about where the bytes get delivered.
  const overrideTo = process.env.EMAIL_FORWARD_OVERRIDE_TO?.trim();
  const deliveryRecipients = overrideTo ? [overrideTo] : input.recipients;
  const overrideSubject = overrideTo
    ? `[DEV → ${input.recipients.join(", ")}] ${input.subject}`
    : input.subject;

  // Build the attachment list from the user's per-file selection. The
  // modal calls checkBillPdfAvailability on open and lets the user
  // check/uncheck each available PDF; selected ids ride through here as
  // namespaced strings (`file:<uuid>` or `bulk:<uuid>`).
  //
  // Back-compat: older callers that still send `attachedOriginal: true`
  // without an explicit attachedFileIds get "all available" — keeps
  // existing automations working while the UI migrates.
  //
  // `attachedSummary` is intentionally NOT wired here: no supplier-invoice
  // PDF renderer exists yet (the customer-side has one in lib/invoices/
  // sales-invoice-pdf, the supplier side doesn't). The checkbox is
  // disabled in the modal until that renderer lands; the boolean is
  // still persisted so the future implementation can backfill history.
  const attachments: Array<{ filename: string; content: string }> = [];
  type AttachmentSource = {
    objectKey: string;
    filename: string | null;
    mimeType: string | null;
  };
  // Build a lookup over EVERY source attached to this invoice. The user's
  // selection is validated against this map — no forged ids slip through.
  const sourceById = new Map<string, AttachmentSource>();
  for (const att of invoice.attachments) {
    if (!att.file) continue;
    sourceById.set(`file:${att.file.id}`, {
      objectKey: att.file.objectKey,
      filename: att.file.originalFilename,
      mimeType: att.file.mimeType,
    });
  }
  const bulkRows = await db
    .select({
      id: bulkImportFiles.id,
      objectKey: bulkImportFiles.objectKey,
      filename: bulkImportFiles.filename,
      mimeType: bulkImportFiles.mimeType,
    })
    .from(bulkImportFiles)
    .where(
      and(
        eq(bulkImportFiles.tenantId, tenant.id),
        eq(bulkImportFiles.supplierInvoiceId, input.supplierInvoiceId),
        isNull(bulkImportFiles.deletedAt),
      ),
    );
  for (const r of bulkRows) {
    sourceById.set(`bulk:${r.id}`, {
      objectKey: r.objectKey,
      filename: r.filename,
      mimeType: r.mimeType,
    });
  }

  // Resolve which ids to actually download.
  const requestedIds = input.attachedFileIds
    ? input.attachedFileIds
    : input.attachedOriginal
      ? Array.from(sourceById.keys())
      : [];

  if (input.attachedOriginal && requestedIds.length === 0) {
    // attachedOriginal=true survived but no candidates → explicit error
    // so the sender knows to uncheck rather than silently sending
    // body-only.
    throw new Error(
      "This bill has no source PDF on file — uncheck \"Original PDF\" to send the message without an attachment.",
    );
  }

  for (const id of requestedIds) {
    const source = sourceById.get(id);
    if (!source) {
      // Forged or stale id — ignore rather than throw, so a single
      // missing entry doesn't kill the whole send. Logged for triage.
      console.warn(
        `[forward-bill] attached file id ${id} not on invoice ${input.supplierInvoiceId}`,
      );
      continue;
    }
    try {
      const bytes = await downloadFile(source.objectKey);
      const filename =
        source.filename ??
        `${invoice.invoiceNumber ?? invoice.referenceNumber}.pdf`;
      attachments.push({
        filename,
        content: bytes.toString("base64"),
      });
    } catch (err) {
      // Don't sink the whole forward on a single R2 hiccup — log + keep
      // going with the other selected attachments + the body.
      console.error(
        `[forward-bill] failed to load attachment ${id} for invoice ${input.supplierInvoiceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const emailResult = await resend.emails.send({
    from: fromAddress,
    replyTo: senderEmail,
    to: deliveryRecipients,
    subject: overrideSubject,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; color: #0c0a09;">
        ${htmlBody}
      </div>
    `,
    text: input.messageBody,
    ...(attachments.length > 0 ? { attachments } : {}),
  });

  if (emailResult.error) {
    throw new Error(`Email failed: ${emailResult.error.message}`);
  }

  // bill_forwards.attachedOriginal is the legacy column — derive it
  // from whether ANY file actually went out. The audit log carries the
  // richer count + selected ids for forensic lookups.
  const anyAttached = attachments.length > 0;

  await db.insert(billForwards).values({
    tenantId: tenant.id,
    supplierInvoiceId: input.supplierInvoiceId,
    sentByUserId: user.id,
    recipients: input.recipients,
    subject: input.subject,
    messageBody: input.messageBody,
    attachedOriginal: anyAttached,
    attachedSummary: input.attachedSummary,
    deliveryStatus: "sent",
    deliveryEvents: [],
  });

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "bill.forward",
    resourceType: "supplier_invoice",
    resourceId: input.supplierInvoiceId,
    metadata: {
      recipientCount: input.recipients.length,
      subject: input.subject,
      attachedOriginal: anyAttached,
      attachedSummary: input.attachedSummary,
      attachedFileIds: requestedIds,
      attachedFileCount: attachments.length,
    },
  });

  await captureServerEvent({
    userId: user.id,
    tenantId: tenant.id,
    event: "bill.forwarded",
    properties: {
      recipient_count: input.recipients.length,
      attachment_count: attachments.length,
      includes_summary: input.attachedSummary,
    },
  });
}
