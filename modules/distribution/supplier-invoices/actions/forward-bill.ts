"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { billForwards, supplierInvoices } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { captureServerEvent } from "@/lib/posthog-server";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { resend } from "@/lib/email";
import {
  applyRateLimit,
  rateLimiters,
  RateLimitError,
} from "@/lib/rate-limit";
import { isPlatformAdminAuthUser } from "@/lib/platform-admin";

export type ForwardBillInput = {
  supplierInvoiceId: string;
  recipients: string[];
  subject: string;
  messageBody: string;
  attachedOriginal: boolean;
  attachedSummary: boolean;
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
        limit: 1,
      },
    },
  });

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "draft") throw new Error("Cannot forward draft bills");
  if (input.recipients.length === 0) throw new Error("At least one recipient required");
  if (input.recipients.length > 10) throw new Error("Maximum 10 recipients");

  // Build a tenant-aware From header so recipients see the customer's brand
  // both in the display name AND in the address local-part — e.g.
  //   From: "City Diner" <city-diner-bills@fluxora.com>
  //
  // Critical: only ONE domain (ROOT_DOMAIN) is verified in Resend. We don't
  // need to add a Resend domain per tenant — varying the local-part is
  // free, signs against the same DKIM key, and avoids the
  // $/domain/month + onboarding cost of per-tenant sending domains.
  // If/when we later add tenant-owned sending domains, this is the seam
  // to swap.
  const rootDomain = process.env.ROOT_DOMAIN ?? "example.com";
  // Sanitize the slug to a safe email-local-part (a-z, 0-9, hyphen). Caps
  // at 50 chars so adding the "-bills" suffix stays under RFC 5321's
  // 64-char local-part limit. Falls back to "bills" if the slug isn't
  // usable, so the email always sends from a valid address.
  const safeSlug = tenant.slug
    ?.toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const fromLocalPart = safeSlug ? `${safeSlug}-bills` : "bills";
  // Display name pulled from tenant branding. Strip any chars that would
  // break the quoted From header (double quote, backslash, newline).
  const rawDisplayName =
    tenant.displayName?.trim() || tenant.companyLegalName?.trim() || null;
  const safeDisplayName = rawDisplayName
    ? rawDisplayName.replace(/[\\"\r\n]/g, "").slice(0, 100)
    : null;
  const fromAddress =
    process.env.EMAIL_FROM ??
    (safeDisplayName
      ? `"${safeDisplayName}" <${fromLocalPart}@${rootDomain}>`
      : `${fromLocalPart}@${rootDomain}`);
  const senderEmail = user.email ?? `${fromLocalPart}@${rootDomain}`;

  const htmlBody = input.messageBody
    .split("\n")
    .map(line => `<p style="margin: 0 0 8px;">${line || "&nbsp;"}</p>`)
    .join("");

  const emailResult = await resend.emails.send({
    from: fromAddress,
    replyTo: senderEmail,
    to: input.recipients,
    subject: input.subject,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; color: #0c0a09;">
        ${htmlBody}
      </div>
    `,
    text: input.messageBody,
  });

  if (emailResult.error) {
    throw new Error(`Email failed: ${emailResult.error.message}`);
  }

  await db.insert(billForwards).values({
    tenantId: tenant.id,
    supplierInvoiceId: input.supplierInvoiceId,
    sentByUserId: user.id,
    recipients: input.recipients,
    subject: input.subject,
    messageBody: input.messageBody,
    attachedOriginal: input.attachedOriginal,
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
      attachedOriginal: input.attachedOriginal,
      attachedSummary: input.attachedSummary,
    },
  });

  await captureServerEvent({
    userId: user.id,
    tenantId: tenant.id,
    event: "bill.forwarded",
    properties: {
      recipient_count: input.recipients.length,
      includes_summary: input.attachedSummary,
    },
  });
}
