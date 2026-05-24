"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, salesInvoices } from "@/db/schema";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { resolveOutboundFromAddress } from "@/lib/email-from-address";

export type InvoiceSendPreview = {
  /** Whether the invoice was found in this tenant. False = modal renders an error. */
  found: boolean;
  /**
   * The customer's saved billing email, or null if none. Pre-fills the
   * "To:" field in the modal — the user can edit before sending.
   */
  defaultRecipient: string | null;
  /**
   * Bare email the recipient will see in the From header — matches what
   * sendInvoiceToCustomerAction will actually send (same
   * resolveOutboundFromAddress helper). Used by the modal's helper-text
   * preview so the displayed address is always truthful.
   */
  fromEmail: string;
  /** Display name shown alongside the from email — tenant brand. */
  fromDisplayName: string | null;
  /** The current user's email — Reply-To header value. */
  replyToEmail: string | null;
  /**
   * Has this invoice been emailed before? Powers the "Send" vs "Resend"
   * label flip on the submit button. Null = never sent.
   */
  lastSentAt: Date | null;
  sendCount: number;
};

/**
 * The Send Invoice modal calls this on mount. Returns the customer's
 * default email, the From/Reply-To envelope (so helper text is
 * truthful), and the prior-send state so the UI can render
 * "Resend (3rd time)" vs the bare "Send" label.
 *
 * Tenant-scoped — a forged invoiceId from another tenant returns
 * `found: false` instead of throwing, so the modal can render a clean
 * error state. The From/Reply-To envelope is still returned so the
 * helper text shows the truthful default even before invoice details
 * resolve.
 */
export async function checkInvoiceSendPreview(
  salesInvoiceId: string,
): Promise<InvoiceSendPreview> {
  const [tenant, currentUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);

  const fromResolved = resolveOutboundFromAddress(tenant, "invoices");
  const previewEnvelope = {
    fromEmail: fromResolved.email,
    fromDisplayName: fromResolved.displayName,
    replyToEmail: currentUser.email ?? null,
  };

  // Single query — the invoice + customer email together, with tenant
  // guards on both sides. A forged invoiceId from another tenant
  // returns null here; we surface that as `found: false`.
  const row = await db
    .select({
      invoiceId: salesInvoices.id,
      customerEmail: customers.email,
      lastSentAt: salesInvoices.lastSentAt,
      sendCount: salesInvoices.sendCount,
    })
    .from(salesInvoices)
    .innerJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(
      and(
        eq(salesInvoices.id, salesInvoiceId),
        eq(salesInvoices.tenantId, tenant.id),
      ),
    )
    .limit(1);

  if (row.length === 0) {
    return {
      found: false,
      defaultRecipient: null,
      lastSentAt: null,
      sendCount: 0,
      ...previewEnvelope,
    };
  }

  const r = row[0];
  return {
    found: true,
    defaultRecipient: r.customerEmail?.trim() || null,
    lastSentAt: r.lastSentAt,
    sendCount: r.sendCount,
    ...previewEnvelope,
  };
}
