import {
  Display,
  EmailShell,
  FallbackUrl,
  Helper,
  Lead,
  PrimaryButton,
} from "./_shell";

type VerifyEmailProps = {
  name?: string | null;
  url: string;
};

export function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <EmailShell
      preview="Verify your email for Fluxora"
      eyebrow="Verify email"
    >
      <Display>Confirm your email.</Display>
      <Lead>
        {name ? `Hi ${name},` : "Hi,"} we just need to confirm this is your
        address before your Fluxora account is fully set up.
      </Lead>

      <PrimaryButton href={url} label="Verify email →" />

      <FallbackUrl url={url} />

      <Helper>
        Didn&apos;t create a Fluxora account? You can safely ignore this
        email.
      </Helper>
    </EmailShell>
  );
}

export default VerifyEmail;
