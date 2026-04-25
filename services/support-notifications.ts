import { db } from "@/db";

type SupportNotification = {
  to: string[];
  subject: string;
  message: string;
};

async function sendSupportNotification(input: SupportNotification) {
  const recipients = input.to.filter(Boolean);
  if (recipients.length === 0) {
    console.info("[support-notification]", input.subject, input.message);
    return;
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.info("[support-notification]", {
      to: recipients,
      subject: input.subject,
      message: input.message,
    });
    return;
  }

  const { resend, emailFrom } = await import("@/lib/email");
  await resend.emails.send({
    from: emailFrom,
    to: recipients,
    subject: input.subject,
    text: input.message,
  });
}

export async function notifyPlatformAdminsOfNewTicket(args: {
  ticketId: string;
  subject: string;
  tenantName: string;
  submittedBy: string;
}) {
  const admins = await db.query.platformUsers.findMany({
    where: (table, { eq }) => eq(table.isActive, true),
    with: { authUser: true },
  });

  await sendSupportNotification({
    to: admins.map(admin => admin.authUser.email),
    subject: `New support ticket: ${args.subject}`,
    message: [
      `Tenant: ${args.tenantName}`,
      `Submitted by: ${args.submittedBy}`,
      `Ticket ID: ${args.ticketId}`,
    ].join("\n"),
  });
}

export async function notifyAssignedPlatformUser(args: {
  email: string | null | undefined;
  ticketId: string;
  subject: string;
}) {
  await sendSupportNotification({
    to: args.email ? [args.email] : [],
    subject: `Support ticket assigned: ${args.subject}`,
    message: `You have been assigned support ticket ${args.ticketId}.`,
  });
}

export async function notifyTenantSubmitter(args: {
  email: string;
  subject: string;
  message: string;
}) {
  await sendSupportNotification({
    to: [args.email],
    subject: args.subject,
    message: args.message,
  });
}
