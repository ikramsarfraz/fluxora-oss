import Link from "next/link";

import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { buildPublicSupportMailto } from "@/lib/public-contact";

type Status = "verifying" | "success" | "expired" | "used" | "invalid";

const STATUSES: Status[] = ["verifying", "success", "expired", "used", "invalid"];

function parseStatus(raw: string | string[] | undefined): Status {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "verifying";
  return STATUSES.includes(value as Status) ? (value as Status) : "invalid";
}

export default async function MagicLinkVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    email?: string;
    next?: string;
    token?: string;
  }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const email = params.email ?? "";
  const next = params.next ?? "/onboarding";
  const token = params.token ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <header className="flex items-center justify-between border-b-[0.5px] border-border-soft px-8 py-[18px]">
        <Link
          href="/"
          className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink transition-opacity hover:opacity-80"
        >
          <FluxoraMark size={28} />
          Fluxora
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <section className="flex w-full max-w-[440px] flex-col items-center gap-7 rounded-xl border-[0.5px] border-border-soft bg-card p-9 shadow-[0_1px_2px_rgba(26,26,20,0.05),0_8px_24px_rgba(26,26,20,0.06)]">
          {status === "verifying" && <VerifyingView email={email} next={next} />}
          {status === "success" && <SuccessView email={email} next={next} />}
          {status === "expired" && <ExpiredView email={email} />}
          {status === "used" && <UsedView email={email} />}
          {status === "invalid" && <InvalidView token={token} />}

          <div className="flex w-full items-center justify-center gap-2 border-t-[0.5px] border-divider pt-3.5 font-mono text-[10.5px] tracking-[0.02em]">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              {statusLabel(status)}
            </span>
            <span className="text-ink-warm">
              {token ? `tk_${token.slice(0, 12)}…` : "tk_…"}
            </span>
          </div>
        </section>
      </main>

      <footer className="px-8 py-5 text-center text-[12.5px] text-subtle">
        Trouble signing in?{" "}
        <a
          href={buildPublicSupportMailto("Magic-link verification issue")}
          className="border-b border-transparent pb-[1px] font-medium text-ink transition-colors hover:border-ink"
        >
          Contact support
        </a>{" "}
        ·{" "}
        <span className="text-muted">incident response in &lt; 1 hr</span>
      </footer>
    </div>
  );
}

function statusLabel(status: Status): string {
  switch (status) {
    case "verifying":
      return "Verifying";
    case "success":
      return "Verified";
    case "expired":
      return "Expired";
    case "used":
      return "Consumed";
    case "invalid":
      return "Invalid";
  }
}

function StateIcon({
  tone,
  glyph,
}: {
  tone: "forest" | "success" | "warning" | "used" | "danger";
  glyph: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    forest: "bg-forest-tint text-forest",
    success: "bg-success-bg text-success-fg",
    warning: "bg-warning-bg text-warning-fg",
    used: "bg-info-bg text-info-fg",
    danger: "bg-danger-bg text-danger-fg",
  };
  return (
    <span
      className={`grid size-14 place-items-center rounded-full text-[22px] font-semibold ${tones[tone]}`}
    >
      {glyph}
    </span>
  );
}

function StateHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-center">
      <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
        {title}
      </h1>
      <p className="text-[14px] leading-[1.55] text-subtle">{subtitle}</p>
    </div>
  );
}

function DetailRow({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "ok" | "warn" | "bad" | "muted";
}) {
  const toneClass =
    tone === "ok"
      ? "text-success-fg"
      : tone === "warn"
        ? "text-warning-fg"
        : tone === "bad"
          ? "text-danger-fg"
          : tone === "muted"
            ? "text-muted"
            : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle">
        {label}
      </span>
      <span className={`font-mono text-[12px] ${toneClass}`}>{children}</span>
    </div>
  );
}

function VerifyingView({ email, next }: { email: string; next: string }) {
  return (
    <>
      <StateIcon
        tone="forest"
        glyph={
          <span
            aria-hidden
            className="size-7 animate-[loading-spin_800ms_linear_infinite] rounded-full border-[2.5px] border-forest-tint-deep border-t-forest"
          />
        }
      />
      <StateHead
        title="Signing you in…"
        subtitle={
          <>
            Verifying your link
            {email ? (
              <>
                {" for "}
                <span className="font-medium text-ink">{email}</span>
              </>
            ) : null}
            . This usually takes a second.
          </>
        }
      />
      <ol className="flex w-full items-center justify-between gap-2 px-2">
        {["Link", "Token", "Session", "Route"].map((label, i) => (
          <li key={label} className="flex items-center gap-2 text-[11.5px]">
            <span
              className={`size-[7px] rounded-full ${
                i < 2 ? "bg-forest" : "bg-border-default"
              }`}
            />
            <span className={i < 2 ? "text-ink" : "text-muted"}>{label}</span>
            {i < 3 && <span className="ml-2 h-px w-3 bg-border-default" />}
          </li>
        ))}
      </ol>
      {/* If a magic-link verifier mounts this page mid-flight, gently nudge
          forward to the next page after a beat. Server-side validation
          should already be redirecting, but this is a belt-and-suspenders
          fallback for slow clients. */}
      <meta httpEquiv="refresh" content={`5;url=${encodeURI(next)}`} />
    </>
  );
}

function SuccessView({ email, next }: { email: string; next: string }) {
  const now = new Date();
  const verifiedAt = `${now.toISOString().slice(0, 10)} · ${now
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    .toLowerCase()}`;
  const destinationLabel = next.includes("onboarding")
    ? "→ Onboarding (new account)"
    : next.includes("select-destination")
      ? "→ Workspace picker"
      : `→ ${next}`;
  return (
    <>
      <StateIcon tone="success" glyph="✓" />
      <StateHead
        title="You're in."
        subtitle={
          <>
            {email ? (
              <>
                Signed in as <span className="font-medium text-ink">{email}</span>.
              </>
            ) : (
              "You're signed in."
            )}{" "}
            Routing you to your workspace…
          </>
        }
      />
      <div className="flex w-full flex-col gap-2 rounded-md border-[0.5px] border-border-soft bg-card-warm p-3.5">
        {email ? <DetailRow label="Email">{email}</DetailRow> : null}
        <DetailRow label="Verified at">{verifiedAt}</DetailRow>
        <DetailRow label="Destination" tone="ok">
          {destinationLabel}
        </DetailRow>
      </div>
      <Link
        href={next}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-forest px-4 py-3 text-[14px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
      >
        Continue <span aria-hidden>→</span>
      </Link>
      <p className="font-mono text-[10.5px] tracking-[0.04em] text-muted">
        Auto-redirecting in 3s…
      </p>
      <meta httpEquiv="refresh" content={`3;url=${encodeURI(next)}`} />
    </>
  );
}

function ExpiredView({ email }: { email: string }) {
  return (
    <>
      <StateIcon tone="warning" glyph="⏲" />
      <StateHead
        title="This link expired."
        subtitle="Sign-in links last 15 minutes for security. Request a new one — it'll arrive in seconds."
      />
      <div className="flex w-full flex-col gap-2 rounded-md border-[0.5px] border-border-soft bg-card-warm p-3.5">
        {email ? <DetailRow label="Sent to">{email}</DetailRow> : null}
        <DetailRow label="Status" tone="warn">
          Expired
        </DetailRow>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <Link
          href="/signup"
          className="rounded-md border-[0.5px] border-border-default bg-card px-4 py-3 text-center text-[13.5px] font-medium text-ink transition-colors hover:bg-card-warm"
        >
          Use a different email
        </Link>
        <Link
          href={email ? `/signup?email=${encodeURIComponent(email)}` : "/signup"}
          className="rounded-md bg-forest px-4 py-3 text-center text-[13.5px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
        >
          Send a new link →
        </Link>
      </div>
    </>
  );
}

function UsedView({ email }: { email: string }) {
  return (
    <>
      <StateIcon tone="used" glyph="↺" />
      <StateHead
        title="This link's already been used."
        subtitle="For security, each magic link is one-shot. If you weren't the one who used it, sign in again and rotate your access tokens."
      />
      <div className="flex w-full flex-col gap-2 rounded-md border-[0.5px] border-border-soft bg-card-warm p-3.5">
        {email ? <DetailRow label="Sent to">{email}</DetailRow> : null}
        <DetailRow label="Status">Consumed</DetailRow>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <Link
          href={buildPublicSupportMailto("Suspicious magic-link use")}
          className="rounded-md border-[0.5px] border-border-default bg-card px-4 py-3 text-center text-[13.5px] font-medium text-ink transition-colors hover:bg-card-warm"
        >
          Wasn&apos;t me
        </Link>
        <Link
          href="/login"
          className="rounded-md bg-forest px-4 py-3 text-center text-[13.5px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
        >
          Sign in again →
        </Link>
      </div>
    </>
  );
}

function InvalidView({ token }: { token: string }) {
  return (
    <>
      <StateIcon tone="danger" glyph="!" />
      <StateHead
        title="We couldn't verify this link."
        subtitle="The token signature didn't match. This usually means the URL was edited, double-encoded by your email client, or the email service modified it for tracking."
      />
      <div className="flex w-full flex-col gap-2 rounded-md border-[0.5px] border-border-soft bg-card-warm p-3.5">
        <DetailRow label="Reason" tone="bad">
          Invalid signature
        </DetailRow>
        <DetailRow label="Token" tone="muted">
          {token ? `tk_${token.slice(0, 8)}…` : "—"}
        </DetailRow>
        <DetailRow label="Suggestion">
          Copy the full link from the email body
        </DetailRow>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <Link
          href={buildPublicSupportMailto("Magic-link verification failed")}
          className="rounded-md border-[0.5px] border-border-default bg-card px-4 py-3 text-center text-[13.5px] font-medium text-ink transition-colors hover:bg-card-warm"
        >
          Get help
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-forest px-4 py-3 text-center text-[13.5px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
        >
          Request a new link →
        </Link>
      </div>
    </>
  );
}
