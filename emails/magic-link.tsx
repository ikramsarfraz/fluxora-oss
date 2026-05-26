import {
  Display,
  EmailShell,
  FallbackUrl,
  Helper,
  Lead,
  NoteCallout,
  PrimaryButton,
} from "./_shell";

type MagicLinkEmailProps = {
  name?: string | null;
  url: string;
};

export function MagicLinkEmail({ name, url }: MagicLinkEmailProps) {
  return (
    <EmailShell
      preview="Your Fluxora sign-in link"
      eyebrow="Sign in · expires in 15 min"
    >
      <Display>Sign in to Fluxora.</Display>
      <Lead>
        {name ? `Hi ${name},` : "Hi,"} tap the button below to finish signing
        in. The link is single-use and expires in fifteen minutes — open it in
        the same browser if you can.
      </Lead>

      <PrimaryButton href={url} label="Continue to sign in →" />

      <FallbackUrl url={url} />

      <NoteCallout>
        We&apos;ll never ask for your password by email. Fluxora uses
        passwordless sign-in by default.
      </NoteCallout>

      <Helper>
        Didn&apos;t request this link? You can safely ignore this email — no
        account changes were made.
      </Helper>
    </EmailShell>
  );
}

export default MagicLinkEmail;
