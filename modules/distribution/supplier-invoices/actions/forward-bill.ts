"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { billForwards, supplierInvoices } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
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

  const senderEmail = user.email ?? `bills@${process.env.ROOT_DOMAIN ?? "example.com"}`;
  const fromAddress = process.env.EMAIL_FROM ?? `bills@${process.env.ROOT_DOMAIN ?? "example.com"}`;

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
}
