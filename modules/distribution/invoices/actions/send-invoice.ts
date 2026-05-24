"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { salesInvoiceEmails, salesInvoices } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { captureServerEvent } from "@/lib/posthog-server";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import {
  getCurrentTenant,
  getTenantLogoUrl,
} from "@/modules/core/tenants/services/tenants";
import { resend } from "@/lib/email";
import {
  applyRateLimit,
  rateLimiters,
  RateLimitError,
} from "@/lib/rate-limit";
import { isPlatformAdminAuthUser } from "@/lib/platform-admin";
import { resolveOutboundFromAddress } from "@/lib/email-from-address";
import {
  getSalesInvoicePdfFilename,
  renderSalesInvoicePdf,
} from "@/modules/distribution/invoices/pdf/sales-invoice-pdf";
import { getSalesInvoiceById } from "../services/invoicing";

export type SendInvoiceToCustomerInput = {
  salesInvoiceId: string;
  /** Primary `to:` recipients. Cap mirrors the AP forward flow. */
  recipients: string[];
  /** Optional cc list — same cap, applied to total of to+cc. */
  ccRecipients?: string[];
  subject: string;
  messageBody: string;
  /**
   * Attach the rendered invoice PDF? Default true; allow opting out
   * for a follow-up "ping" send where the customer already has the
   * PDF from the first send.
   */
  attachPdf?: boolean;
};

// Keep total recipient count bounded — same shape as forwardBillAction.
// Resend's free tier caps at 50/email; we stay well under.
const MAX_TOTAL_RECIPIENTS = 10;

/**
 * Emails a sales invoice to the customer.
 *
 * Mirrors the AP forwardBillAction shape (tenant-aware From, dev-only
 * recipient override, audit + posthog logging) but with three AR-specific
 * twists:
 *
 *   1. The attached PDF is *rendered* on the fly via renderSalesInvoicePdf
 *      — there is no stored source PDF the way AP bills have an
 *      original. The renderer is the same one /api/invoices/[id]/pdf
 *      uses, so the customer sees byte-identical output to whatever
 *      preview the user just looked at.
 *
 *   2. On the first successful send the invoice flips `draft → sent`.
 *      Re-sends leave status alone (it might already be `partially_paid`
 *      or `paid` if the customer paid before they got the email — common).
 *
 *   3. last_sent_at + send_count get bumped on every successful send so
 *      the detail page can render "Last sent on …" without aggregating
 *      sales_invoice_emails.
 *
 * Failures: if Resend rejects the send, we throw before any DB writes —
 * no half-state, no audit row, no status flip.
 */
export async function sendInvoiceToCustomerAction(
  input: SendInvoiceToCustomerInput,
) {
  const [user, tenant] = await Promise.all([
    getCurrentPortalUser(),
    getCurrentTenant(),
  ]);

  if (!(await isPlatformAdminAuthUser(user.authUserId))) {
    // Shared limiter with AP forwards: 50 outbound emails per tenant per
    // day. Same Resend budget, same abuse surface, so one bucket is
    // sufficient and easier to reason about than two.
    const result = await applyRateLimit(
      rateLimiters.emailForward,
      `tenant:${tenant.id}`,
    );
    if (!result.success) {
      throw new RateLimitError(result.retryAfterSeconds);
    }
  }

  const recipients = input.recipients.map(r => r.trim()).filter(Boolean);
  const ccRecipients = (input.ccRecipients ?? [])
    .map(r => r.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    throw new Error("At least one recipient is required");
  }
  if (recipients.length + ccRecipients.length > MAX_TOTAL_RECIPIENTS) {
    throw new Error(`Maximum ${MAX_TOTAL_RECIPIENTS} recipients (to + cc combined)`);
  }
  if (input.subject.trim().length === 0) {
    throw new Error("Subject is required");
  }

  // Tenant-scope guard up front. getSalesInvoiceById already filters by
  // tenant; an explicit check here means a regression in the service
  // can't leak a cross-tenant send via this action.
  const invoice = await getSalesInvoiceById(input.salesInvoiceId);
  if (!invoice || invoice.tenantId !== tenant.id) {
    throw new Error("Invoice not found");
  }
  if (invoice.status === "void") {
    throw new Error("Cannot send a voided invoice");
  }

  // From + Reply-To resolution lives in resolveOutboundFromAddress so the
  // exact same logic powers the modal's helper text preview (via
  // checkInvoiceSendPreview). Recipient + sender see identical addresses
  // to what the user just inspected.
  const fromResolved = resolveOutboundFromAddress(tenant, "invoices");
  const fromAddress = fromResolved.header;
  const senderEmail = user.email ?? fromResolved.email;

  const htmlBody = input.messageBody
    .split("\n")
    .map(line => `<p style="margin: 0 0 8px;">${line || "&nbsp;"}</p>`)
    .join("");

  // Dev-only safety net — shared with the AP forward flow. When
  // EMAIL_FORWARD_OVERRIDE_TO is set, every outbound goes to that single
  // inbox instead of the user-typed recipients. Lets a developer click
  // "Send invoice" against a real customer without paging the actual
  // customer. The DB row + audit log below STILL record the original
  // recipients so the sales_invoice_emails history matches what a
  // developer would see in production — the override is purely about
  // where the bytes get delivered.
  const overrideTo = process.env.EMAIL_FORWARD_OVERRIDE_TO?.trim();
  const deliveryRecipients = overrideTo ? [overrideTo] : recipients;
  const deliveryCc = overrideTo ? [] : ccRecipients;
  const overrideSubject = overrideTo
    ? `[DEV → ${[...recipients, ...ccRecipients].join(", ")}] ${input.subject}`
    : input.subject;

  // Render the PDF unless the caller opted out. The renderer is sync
  // for one invoice (no network), so we just await inline rather than
  // pre-rendering in the preview action — saves a wasted render for
  // body-only sends.
  const attachPdf = input.attachPdf ?? true;
  let attachments: Array<{ filename: string; content: string }> = [];
  if (attachPdf) {
    const logoUrl = await getTenantLogoUrl(tenant).catch(() => null);
    const pdfBytes = await renderSalesInvoicePdf({
      tenant,
      invoice,
      logoUrl,
    });
    attachments = [
      {
        filename: getSalesInvoicePdfFilename(invoice),
        content: pdfBytes.toString("base64"),
      },
    ];
  }

  const emailResult = await resend.emails.send({
    from: fromAddress,
    replyTo: senderEmail,
    to: deliveryRecipients,
    ...(deliveryCc.length > 0 ? { cc: deliveryCc } : {}),
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

  // Flip draft → sent on the first send. We DON'T touch partially_paid
  // or paid — those can both legitimately reach this action when the
  // user is re-sending a receipt, and demoting them to "sent" would lie
  // about the payment state. The bumping of last_sent_at + send_count
  // is unconditional and tells the UI "yes, an outbound went out".
  const sentAt = new Date();
  await db
    .update(salesInvoices)
    .set({
      ...(invoice.status === "draft" ? { status: "sent" as const } : {}),
      lastSentAt: sentAt,
      sendCount: sql`${salesInvoices.sendCount} + 1`,
    })
    .where(
      and(
        eq(salesInvoices.id, input.salesInvoiceId),
        eq(salesInvoices.tenantId, tenant.id),
      ),
    );

  await db.insert(salesInvoiceEmails).values({
    tenantId: tenant.id,
    salesInvoiceId: input.salesInvoiceId,
    sentByUserId: user.id,
    recipients,
    ccRecipients,
    subject: input.subject,
    messageBody: input.messageBody,
    attachedPdf: attachments.length > 0,
    deliveryStatus: "sent",
    deliveryEvents: [],
    resendMessageId: emailResult.data?.id ?? null,
    sentAt,
  });

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "invoice.send",
    resourceType: "sales_invoice",
    resourceId: input.salesInvoiceId,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      recipientCount: recipients.length,
      ccCount: ccRecipients.length,
      subject: input.subject,
      attachedPdf: attachments.length > 0,
      resendMessageId: emailResult.data?.id ?? null,
      statusFlipped: invoice.status === "draft",
      sendCountBefore: invoice.sendCount ?? 0,
    },
  });

  await captureServerEvent({
    userId: user.id,
    tenantId: tenant.id,
    event: "invoice.sent",
    properties: {
      recipient_count: recipients.length,
      cc_count: ccRecipients.length,
      attached_pdf: attachments.length > 0,
      status_flipped: invoice.status === "draft",
    },
  });

  return {
    success: true as const,
    resendMessageId: emailResult.data?.id ?? null,
    statusFlipped: invoice.status === "draft",
  };
}
