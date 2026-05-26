import { Check, Mail } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { session as sessionTable } from "@/db/auth-schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getUserByAuthUserId } from "@/modules/shared/services/portal-users";
import { getInitials } from "@/lib/utils/get-initials";

import { SendSignInLinkButton } from "./send-sign-in-link-button";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
  accountant: "Accountant",
  warehouse: "Warehouse",
  user: "Member",
};

const ROLE_DESCRIPTION: Record<string, string> = {
  owner: "Full permissions",
  admin: "Full permissions",
  manager: "Operations + reporting",
  sales: "Sales + customers",
  accountant: "Invoicing + payments",
  warehouse: "Inventory + receiving",
  user: "Read-only",
};

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function summarizeUserAgent(ua: string | null): {
  device: string;
  os: string;
} {
  if (!ua) return { device: "Unknown device", os: "—" };
  const lower = ua.toLowerCase();
  let browser = "Unknown browser";
  if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";
  else if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("safari")) browser = "Safari";

  let os = "Unknown";
  if (lower.includes("iphone") || lower.includes("ios")) os = "iPhone";
  else if (lower.includes("ipad")) os = "iPad";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("mac os x") || lower.includes("macos")) os = "macOS";
  else if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("linux")) os = "Linux";

  return { device: browser, os };
}

export default async function SettingsAccountProfilePage() {
  const authSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!authSession?.user?.id) {
    redirect("/sign-in");
  }

  const tenant = await getCurrentTenant();
  const portalUser = await getUserByAuthUserId(authSession.user.id, tenant.id);

  if (!portalUser) {
    return (
      <div className="flex max-w-lg flex-col gap-4 p-8">
        <h1 className="font-serif text-[26px] font-medium tracking-[-0.02em] text-ink">
          Account
        </h1>
        <p className="text-[13px] leading-[1.55] text-subtle">
          No portal profile is linked to this sign-in yet. Ask an administrator
          to invite you or complete onboarding.
        </p>
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-[7px] text-[13px] font-medium text-ink-warm transition-colors hover:bg-surface"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const displayName =
    portalUser.fullName?.trim() || portalUser.authUser?.name?.trim() || portalUser.email;
  const email = portalUser.email ?? portalUser.authUser?.email ?? "";
  const emailVerified = Boolean(portalUser.authUser?.emailVerified);
  const roleLabel = ROLE_LABEL[portalUser.role] ?? portalUser.role;
  const roleDescription =
    ROLE_DESCRIPTION[portalUser.role] ?? "Custom permissions";

  // Recent sessions — most recent 6 for the current auth user.
  const sessions = await db
    .select({
      id: sessionTable.id,
      createdAt: sessionTable.createdAt,
      updatedAt: sessionTable.updatedAt,
      expiresAt: sessionTable.expiresAt,
      ipAddress: sessionTable.ipAddress,
      userAgent: sessionTable.userAgent,
    })
    .from(sessionTable)
    .where(eq(sessionTable.userId, authSession.user.id))
    .orderBy(desc(sessionTable.updatedAt))
    .limit(6);

  const currentSessionId = authSession.session?.id ?? null;
  const lastSignInAt =
    sessions[0]?.createdAt ?? portalUser.updatedAt ?? portalUser.createdAt;

  return (
    <div className="flex flex-1 flex-col gap-6 pb-12">
      {/* Hero card */}
      <div className="rounded-lg border-[0.5px] border-border-soft bg-card">
        <div className="flex flex-wrap items-start justify-between gap-6 px-8 py-7">
          <div className="flex items-center gap-5">
            <Avatar name={displayName} size={72} fontSize={30} />
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Your account
              </div>
              <h1 className="mt-[6px] font-serif text-[30px] font-medium leading-[1.1] tracking-[-0.02em] text-ink">
                {displayName}
              </h1>
              <div className="mt-[10px] flex flex-wrap items-center gap-3 text-[13px] text-ink-warm">
                <span className="inline-flex items-center gap-[6px]">
                  <Mail size={13} strokeWidth={1.5} aria-hidden />
                  {email}
                </span>
                <span aria-hidden className="text-muted">
                  ·
                </span>
                <Pill tone="info">{roleLabel}</Pill>
                <span aria-hidden className="text-muted">
                  ·
                </span>
                <Pill tone="ok">{portalUser.isActive ? "Active" : "Disabled"}</Pill>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <SendSignInLinkButton
              email={email}
              tenantSlug={tenant.slug}
              displayName={displayName}
            />
            <div className="text-[11px] text-subtle">
              Magic link to {email}
            </div>
          </div>
        </div>
      </div>

      {/* Three fact cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FactCard label="Identity">
          <Kv label="Display name" value={displayName} />
          <Kv label="Email" value={email} mono />
          <Kv
            label="Workspace"
            value={
              <span>
                {tenant.name}{" "}
                <span className="text-subtle">·</span>{" "}
                <span className="font-mono text-subtle">{tenant.slug}</span>
              </span>
            }
          />
        </FactCard>

        <FactCard label="Access">
          <Kv
            label="Role"
            value={
              <span className="inline-flex items-center gap-2">
                <Pill tone="info">{roleLabel}</Pill>
                <span className="text-[11px] text-subtle">
                  {roleDescription}
                </span>
              </span>
            }
          />
          <Kv
            label="Status"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Check
                  size={12}
                  strokeWidth={1.5}
                  className="text-forest"
                  aria-hidden
                />
                {portalUser.isActive ? "Active" : "Disabled"}
              </span>
            }
          />
          <Kv
            label="Email verified"
            value={
              <span className="inline-flex items-center gap-1.5">
                {emailVerified ? (
                  <>
                    <Check
                      size={12}
                      strokeWidth={1.5}
                      className="text-forest"
                      aria-hidden
                    />
                    Verified
                  </>
                ) : (
                  <>Pending</>
                )}
              </span>
            }
          />
        </FactCard>

        <FactCard label="Audit">
          <Kv
            label="Created"
            mono
            value={`${formatDateTime(portalUser.createdAt)} · ${formatTime(portalUser.createdAt)}`}
          />
          <Kv
            label="Last update"
            mono
            value={`${formatDateTime(portalUser.updatedAt)} · ${formatTime(portalUser.updatedAt)}`}
          />
          <Kv
            label="Last sign-in"
            mono
            value={`${formatDateTime(lastSignInAt)} · ${formatTime(lastSignInAt)}`}
          />
        </FactCard>
      </div>

      {/* Recent sessions */}
      <div className="rounded-lg border-[0.5px] border-border-soft bg-card px-6 py-[22px]">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-[17px] font-medium leading-[1.2] tracking-[-0.01em] text-ink">
            Recent sessions
          </h2>
          <Link
            href="/settings/security/activity-log"
            className="px-2 py-[6px] text-[12px] text-subtle transition-colors hover:bg-surface hover:text-ink"
          >
            View activity log →
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="text-[13px] leading-[1.55] text-subtle">
            No active sessions to show.
          </p>
        ) : (
          <div>
            {sessions.map((s, idx) => {
              const isCurrent = s.id === currentSessionId;
              const ua = summarizeUserAgent(s.userAgent);
              return (
                <div
                  key={s.id}
                  className={
                    "grid grid-cols-[180px_1fr_1fr_auto] items-center gap-4 py-3" +
                    (idx > 0 ? " border-t-[0.5px] border-divider" : "")
                  }
                >
                  <div>
                    <div className="font-mono text-[12px] text-ink-warm">
                      {formatDateTime(s.updatedAt ?? s.createdAt)}
                    </div>
                    <div className="mt-[2px] font-mono text-[11px] text-subtle">
                      {formatTime(s.updatedAt ?? s.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] text-ink">
                      {ua.device} · {ua.os}
                    </div>
                    <div className="mt-[2px] text-[11px] text-subtle">
                      Session expires{" "}
                      {formatDateTime(s.expiresAt)}
                    </div>
                  </div>
                  <div className="font-mono text-[12px] text-subtle">
                    {s.ipAddress ?? "—"}
                  </div>
                  <div className="text-right">
                    {isCurrent ? (
                      <Pill tone="ok">This device</Pill>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({
  name,
  size,
  fontSize,
}: {
  name: string;
  size: number;
  fontSize: number;
}) {
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full bg-card-warm font-serif font-medium text-ink shadow-[0_0_0_1px_var(--color-gold)] before:absolute before:inset-[-3px] before:rounded-full before:border-[0.5px] before:border-gold before:opacity-50 before:content-['']"
      style={{ width: size, height: size, fontSize }}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}

type PillTone = "ok" | "warn" | "info";

function Pill({
  tone,
  children,
}: {
  tone: PillTone;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-success-border bg-success-bg text-success-fg"
      : tone === "warn"
        ? "border-warning-border bg-warning-bg text-warning-fg"
        : "border-info-border bg-info-bg text-info-fg";
  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-full border-[0.5px] px-[9px] py-[3px] text-[11px] font-medium leading-none ${cls}`}
    >
      <span
        aria-hidden
        className="inline-block size-[5px] rounded-full bg-current"
      />
      {children}
    </span>
  );
}

function FactCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border-[0.5px] border-border-soft bg-card px-[22px] py-5">
      <div className="mb-[14px] text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-[22px] gap-y-3 text-[13px]">
        {children}
      </dl>
    </div>
  );
}

function Kv({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="pt-[2px] text-[11px] font-medium uppercase tracking-[0.04em] text-subtle">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "font-mono text-[13px] text-ink tabular-nums"
            : "text-[13px] text-ink"
        }
      >
        {value}
      </dd>
    </>
  );
}
