import {
  Display,
  EmailShell,
  FallbackUrl,
  Helper,
  Lead,
  NoteCallout,
  PrimaryButton,
} from "./_shell";

type ResetPasswordProps = {
  name?: string | null;
  url: string;
};

export function ResetPasswordEmail({ name, url }: ResetPasswordProps) {
  return (
    <EmailShell
      preview="Reset your Fluxora password"
      eyebrow="Password reset · expires in 1 hr"
    >
      <Display>Reset your password.</Display>
      <Lead>
        {name ? `Hi ${name},` : "Hi,"} we received a request to reset the
        password on your Fluxora account. Tap below to choose a new one.
      </Lead>

      <PrimaryButton href={url} label="Reset password →" />

      <FallbackUrl url={url} />

      <NoteCallout>
        If you weren&apos;t the one who asked for this, ignore this email —
        your password stays the same. Consider rotating it anyway if the
        request looks suspicious.
      </NoteCallout>

      <Helper>This link expires in one hour for your security.</Helper>
    </EmailShell>
  );
}

export default ResetPasswordEmail;
