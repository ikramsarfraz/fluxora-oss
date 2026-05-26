import { Section, Text } from "@react-email/components";

import {
  DetailRow,
  Display,
  EmailShell,
  FallbackUrl,
  Helper,
  Lead,
  PrimaryButton,
  tokens,
} from "./_shell";

type InviteUserEmailProps = {
  fullName: string;
  inviteUrl: string;
  tenantName?: string | null;
  role?: string | null;
  invitedByName?: string | null;
};

function prettyRole(role: string | null | undefined) {
  if (!role) return null;
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function InviteUserEmail({
  fullName,
  inviteUrl,
  tenantName,
  role,
  invitedByName,
}: InviteUserEmailProps) {
  const workspace = tenantName?.trim() || "Fluxora";
  const roleLabel = prettyRole(role);
  return (
    <EmailShell
      preview={`You're invited to ${workspace} on Fluxora`}
      eyebrow="✦ You've been invited"
    >
      <Display>Join {workspace} on Fluxora.</Display>
      <Lead>
        Hi {fullName}, you&apos;ve been added to{" "}
        <span style={{ fontWeight: 600, color: tokens.ink }}>{workspace}</span>
        {roleLabel ? (
          <>
            {" "}as a{" "}
            <span style={{ fontWeight: 600, color: tokens.ink }}>
              {roleLabel}
            </span>
          </>
        ) : null}
        . Accept the invite below to set up your account and land directly
        inside the workspace.
      </Lead>

      <Section style={{ marginTop: 6, marginBottom: 22 }}>
        <PrimaryButton href={inviteUrl} label="Accept & join workspace →" />
      </Section>

      <Section
        style={{
          padding: "14px 16px",
          backgroundColor: tokens.cardWarm,
          border: `1px solid ${tokens.borderSoft}`,
          borderRadius: 8,
        }}
      >
        <Text
          style={{
            margin: 0,
            marginBottom: 6,
            fontFamily:
              '"Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: tokens.subtle,
          }}
        >
          Invite details
        </Text>
        <DetailRow label="Workspace" value={workspace} />
        {roleLabel ? <DetailRow label="Role" value={roleLabel} /> : null}
        {invitedByName ? (
          <DetailRow label="From" value={invitedByName} />
        ) : null}
        <DetailRow label="Expires" value="7 days from when this was sent" />
      </Section>

      <FallbackUrl url={inviteUrl} />

      <Helper>
        Not expecting this invitation? Ignore the email — the workspace owner
        will see it stayed unused. No action on your part is needed.
      </Helper>
    </EmailShell>
  );
}

export default InviteUserEmail;
