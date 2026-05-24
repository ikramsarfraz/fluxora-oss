"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
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

  // Build a tenant-aware From header so production recipients see the
  // customer's brand in both the display name AND the address local-part —
  // e.g. From: "City Diner" <city-diner-bills@fluxora.com>.
  //
  // Local + staging dev fall back to the single shared EMAIL_FROM address
  // (set in .env.local). Reasons:
  //   - lib/email.ts already requires EMAIL_FROM at module load — every
  //     existing transactional path (auth, tenant-join, etc.) sends from
  //     it. Reusing it here means local dev doesn't need any extra setup.
  //   - Resend's free / hobby tiers usually only have one personal-domain
  //     address verified. Forcing a tenant-aware From in dev would hit
  //     "unverified domain" errors.
  //   - Production has ROOT_DOMAIN's DKIM/SPF wired up, so the
  //     <slug>-bills@<root> local-part variation signs cleanly with a
  //     single verified domain — no per-tenant Resend domain needed.
  //
  // To force the tenant-aware path locally for testing, override NODE_ENV
  // or temporarily branch the check below.
  const isProd = process.env.NODE_ENV === "production";
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
  const tenantAwareFrom = safeDisplayName
    ? `"${safeDisplayName}" <${fromLocalPart}@${rootDomain}>`
    : `${fromLocalPart}@${rootDomain}`;
  // In prod, use the tenant-aware From. Outside prod, use EMAIL_FROM from
  // env (already required to boot). EMAIL_FROM can also force-override
  // prod when set explicitly — useful for staging or rollback.
  const fromAddress = isProd
    ? (process.env.EMAIL_FROM_OVERRIDE ?? tenantAwareFrom)
    : (process.env.EMAIL_FROM ?? tenantAwareFrom);
  const senderEmail = user.email ?? `${fromLocalPart}@${rootDomain}`;

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

  // Attach the supplier-invoice PDF when requested. The PDF can live in
  // one of two places depending on how the bill was created:
  //
  //   1. Manually-uploaded bills → supplier_invoice_attachments → files
  //      (already eagerly loaded as `invoice.attachments[0]?.file`)
  //   2. Bulk-imported bills → bulk_import_files (the row that was
  //      `reviewedAt`-flipped into this supplierInvoiceId)
  //
  // Most bills land via path #2 since bulk import is the common entry.
  // The previous fix only checked path #1, which is why bulk-imported
  // bills forwarded with `Original PDF` checked still arrived with no
  // attachment. Check both, prefer the manual attachment when present
  // (admin may have uploaded a corrected PDF on top of the bulk import).
  //
  // `attachedSummary` is intentionally NOT wired here: no supplier-invoice
  // PDF renderer exists yet (the customer-side has one in lib/invoices/
  // sales-invoice-pdf, the supplier side doesn't). The checkbox is
  // disabled in the modal until that renderer lands; the boolean is
  // still persisted so the future implementation can backfill history.
  const attachments: Array<{ filename: string; content: string }> = [];
  if (input.attachedOriginal) {
    type AttachmentSource = {
      objectKey: string;
      filename: string | null;
      mimeType: string | null;
    };
    let source: AttachmentSource | null = null;

    if (invoice.attachments[0]?.file) {
      const f = invoice.attachments[0].file;
      source = {
        objectKey: f.objectKey,
        filename: f.originalFilename,
        mimeType: f.mimeType,
      };
    } else {
      // Bulk-import path: look up the bulk_import_files row that was
      // reviewed into this invoice. Filter out soft-deleted entries.
      const [bulkRow] = await db
        .select({
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
        )
        .orderBy(desc(bulkImportFiles.createdAt))
        .limit(1);
      if (bulkRow) {
        source = {
          objectKey: bulkRow.objectKey,
          filename: bulkRow.filename,
          mimeType: bulkRow.mimeType,
        };
      }
    }

    if (source) {
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
        // Don't sink the whole forward — log + send the email body alone.
        // The user explicitly chose to forward; failing silently on the
        // attachment is better than losing the whole message. The audit
        // log below will still record attachedOriginal=true, which is
        // a small lie but matches user intent.
        console.error(
          `[forward-bill] failed to load attachment for invoice ${input.supplierInvoiceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      console.warn(
        `[forward-bill] attachedOriginal=true but no PDF found for invoice ${input.supplierInvoiceId} (neither supplier_invoice_attachments nor bulk_import_files)`,
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
