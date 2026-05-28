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

type InvitePlatformUserEmailProps = {
  inviteUrl: string;
  role?: string | null;
  invitedByName?: string | null;
};

function prettyRole(role: string | null | undefined) {
  if (!role) return null;
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function InvitePlatformUserEmail({
  inviteUrl,
  role,
  invitedByName,
}: InvitePlatformUserEmailProps) {
  const roleLabel = prettyRole(role);
  return (
    <EmailShell
      preview="You've been invited to the Pelzer Solutions platform admin"
      eyebrow="✦ Platform admin invitation"
    >
      <Display>Join Pelzer Solutions as a platform operator.</Display>
      <Lead>
        You&apos;ve been invited to the internal{" "}
        <span style={{ fontWeight: 600, color: tokens.ink }}>
          platform admin
        </span>{" "}
        for Pelzer Solutions
        {roleLabel ? (
          <>
            {" "}as a{" "}
            <span style={{ fontWeight: 600, color: tokens.ink }}>
              {roleLabel}
            </span>
          </>
        ) : null}
        . Accept below to set up your sign-in and land directly inside the
        admin console.
      </Lead>

      <Section style={{ marginTop: 6, marginBottom: 22 }}>
        <PrimaryButton
          href={inviteUrl}
          label="Accept & open platform admin →"
        />
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
        <DetailRow label="Workspace" value="Platform admin (admin host)" />
        {roleLabel ? <DetailRow label="Role" value={roleLabel} /> : null}
        {invitedByName ? (
          <DetailRow label="From" value={invitedByName} />
        ) : null}
        <DetailRow label="Expires" value="7 days from when this was sent" />
      </Section>

      <FallbackUrl url={inviteUrl} />

      <Helper>
        Not expecting this invitation? Ignore the email — no action on your
        part is needed, and the platform team will see the link stayed
        unused.
      </Helper>
    </EmailShell>
  );
}

export default InvitePlatformUserEmail;
