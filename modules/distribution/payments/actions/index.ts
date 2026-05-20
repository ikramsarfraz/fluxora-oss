"use server";

import { logAuditEvent } from "@/lib/audit-log";
import { requirePermission } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import {
  getPaymentById,
  getPayments,
  getPaymentsPage,
  getPaymentsSummary,
  updatePayment,
  voidPayment,
  type PaymentFilters,
  type UpdatePaymentInput,
} from "../services/payments";

export async function getPaymentsAction() {
  return await getPayments();
}

export async function getPaymentsPageAction(
  input?: Parameters<typeof getPaymentsPage>[0],
) {
  return await getPaymentsPage(input);
}

export async function getPaymentByIdAction(id: string) {
  return await getPaymentById(id);
}

export async function getPaymentsSummaryAction(
  filters: PaymentFilters = {},
  search: string = "",
) {
  return await getPaymentsSummary(filters, search);
}

export async function voidPaymentAction(id: string) {
  const user = await getCurrentPortalUser();
  requirePermission(user.role, "record_payment");

  // Capture the pre-void snapshot for the audit trail — once voidPayment
  // runs the row is gone.
  const existing = await getPaymentById(id);
  if (!existing) throw new Error("Payment not found.");

  const result = await voidPayment(id);

  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "payment.void",
    resourceType: "payment",
    resourceId: id,
    metadata: {
      salesInvoiceId: existing.salesInvoiceId,
      amount: existing.amount,
      paymentDate: existing.paymentDate,
      paymentMethod: existing.paymentMethod,
    },
  });

  return result;
}

export async function updatePaymentAction(input: UpdatePaymentInput) {
  const user = await getCurrentPortalUser();
  requirePermission(user.role, "record_payment");

  const before = await getPaymentById(input.id);
  if (!before) throw new Error("Payment not found.");

  const result = await updatePayment(input);

  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "payment.update",
    resourceType: "payment",
    resourceId: input.id,
    metadata: {
      salesInvoiceId: before.salesInvoiceId,
      // Diff of only the fields actually changed so the audit trail is
      // legible — { amount: { from: "100.00", to: "150.00" } } etc.
      changes: Object.fromEntries(
        (
          [
            "paymentDate",
            "amount",
            "paymentMethod",
            "checkNumber",
            "referenceNumber",
            "notes",
          ] as const
        )
          .filter(key => input[key] !== undefined && input[key] !== before[key])
          .map(key => [key, { from: before[key], to: input[key] }]),
      ),
    },
  });

  return result;
}
