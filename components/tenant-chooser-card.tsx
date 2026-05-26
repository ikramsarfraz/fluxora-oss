"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { cn } from "@/lib/utils";
import type { PortalUserRole } from "@/modules/shared/services/portal-users";

type TenantChooserTenantDestination = {
  type: "tenant";
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: PortalUserRole;
  continueUrl: string;
  subtitle?: string;
};

type TenantChooserPlatformDestination = {
  type: "platform_admin";
  id: string;
  name: string;
  role: string;
  continueUrl: string;
  subtitle?: string;
};

export type TenantChooserDestination =
  | TenantChooserTenantDestination
  | TenantChooserPlatformDestination;

const DEFAULT_TITLE = "Choose your workspace.";
const DEFAULT_DESCRIPTION =
  "Your account is linked to more than one destination. Pick one to continue — you can switch any time from the sidebar.";

const AVATAR_PALETTE = [
  { bg: "#F4E6C2", fg: "#6B4A0E" }, // mustard
  { bg: "#DCE5DD", fg: "#1F3A2E" }, // forest tint
  { bg: "#EDD4C9", fg: "#8B3415" }, // clay
  { bg: "#E0E8D5", fg: "#4A6B2F" }, // sage
  { bg: "#FBF7EC", fg: "#8B7332" }, // deep gold
];

function avatarColor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "?";
}

export function TenantChooserCard({
  destinations,
  variant = "page",
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  className,
}: {
  destinations: TenantChooserDestination[];
  variant?: "page" | "embedded";
  title?: string;
  description?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");

  const tenantDestinations = useMemo(
    () =>
      destinations.filter(
        (d): d is TenantChooserTenantDestination => d.type === "tenant",
      ),
    [destinations],
  );

  const platformDestinations = useMemo(
    () =>
      destinations.filter(
        (d): d is TenantChooserPlatformDestination =>
          d.type === "platform_admin",
      ),
    [destinations],
  );

  const filteredTenants = useMemo(() => {
    if (!query.trim()) return tenantDestinations;
    const q = query.trim().toLowerCase();
    return tenantDestinations.filter(
      (d) =>
        d.tenantName.toLowerCase().includes(q) ||
        d.tenantSlug.toLowerCase().includes(q),
    );
  }, [tenantDestinations, query]);

  const body = (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        variant === "page" ? "max-w-[680px]" : "max-w-full",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
          Workspace chooser
        </span>
        <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p className="text-[14.5px] leading-[1.55] text-subtle">{description}</p>
      </div>

      {/* Search */}
      <label className="flex items-center gap-2.5 rounded-md border-[0.5px] border-border-default bg-card px-3.5 py-2.5 text-[13px] focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]">
        <span aria-hidden className="text-subtle">⌕</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${tenantDestinations.length} workspace${tenantDestinations.length === 1 ? "" : "s"}…`}
          className="min-w-0 flex-1 border-none bg-transparent text-ink outline-none placeholder:text-muted"
        />
        <kbd className="rounded-sm border-[0.5px] border-border-default bg-card-warm px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.04em] text-subtle">
          ⌘ K
        </kbd>
      </label>

      {/* Tenant workspaces */}
      {tenantDestinations.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionLabel
            left="Your workspaces"
            right={`${tenantDestinations.length} active`}
          />
          <div className="flex flex-col gap-2">
            {filteredTenants.map((d, i) => (
              <WorkspaceRow
                key={d.tenantId}
                name={d.tenantName}
                slug={d.tenantSlug}
                role={String(d.role).replaceAll("_", " ")}
                continueUrl={d.continueUrl}
                subtitle={d.subtitle}
                isMostRecent={i === 0}
              />
            ))}
            {filteredTenants.length === 0 && (
              <div className="rounded-md border-[0.5px] border-border-soft bg-card-warm px-4 py-5 text-center text-[13px] text-subtle">
                No workspaces match &ldquo;{query}&rdquo;.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Platform admin */}
      {platformDestinations.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionLabel left="Platform admin" right="Restricted" />
          <div className="flex flex-col gap-2">
            {platformDestinations.map((d) => (
              <PlatformAdminRow
                key={d.id}
                name={d.name}
                continueUrl={d.continueUrl}
                subtitle={d.subtitle}
              />
            ))}
          </div>
        </section>
      )}

      {/* Create new workspace */}
      <section className="flex flex-col gap-2.5">
        <SectionLabel left="Or start fresh" />
        <Link
          href="/onboarding"
          className="group flex items-center gap-3.5 rounded-md border-[0.5px] border-dashed border-border-default bg-card-warm px-4 py-3 transition-colors hover:border-forest hover:bg-card"
        >
          <span className="grid size-11 place-items-center rounded-md border-[0.5px] border-border-default bg-card font-sans text-[18px] font-semibold text-subtle group-hover:text-forest">
            +
          </span>
          <div className="flex-1">
            <div className="text-[14px] font-medium text-ink">
              Create a new workspace
            </div>
            <p className="text-[12.5px] leading-[1.45] text-subtle">
              Use the same account · get a fresh subdomain &amp; tenant-scoped
              data.
            </p>
          </div>
          <span aria-hidden className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-forest">
            →
          </span>
        </Link>
      </section>

      <div className="flex items-start gap-3 rounded-md border-[0.5px] border-border-soft bg-surface p-4 text-[12.5px] leading-[1.5] text-ink-warm">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-info-bg text-[11px] font-semibold text-info-fg">
          i
        </span>
        <div>
          <div className="text-[12.5px] font-medium text-ink">
            Why am I seeing this?
          </div>
          Your email is a member of more than one workspace, or you signed in
          from a shared device. Picking once sets the default for the rest of
          this session — you can switch from the workspace menu later.
        </div>
      </div>
    </div>
  );

  if (variant === "embedded") {
    return body;
  }

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[0.5px] border-border-soft px-8 py-[18px]">
        <Link
          href="/"
          className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink transition-opacity hover:opacity-80"
        >
          <FluxoraMark size={28} />
          Fluxora
        </Link>
        <div className="flex items-center gap-3 text-[12.5px] text-subtle">
          <Link
            href="/login"
            className="border-b border-transparent pb-[2px] font-medium text-ink transition-colors hover:border-ink"
          >
            Sign out
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-12">
        {body}
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t-[0.5px] border-border-soft px-8 py-[18px] text-[12px] text-subtle">
        <div className="font-mono text-[11px] tracking-[0.04em]">
          © {new Date().getFullYear()} Fluxora, Inc.
        </div>
        <div className="flex gap-[18px]">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between font-sans text-[10px] uppercase tracking-[0.1em]">
      <span className="font-semibold text-subtle">{left}</span>
      {right ? (
        <span className="font-mono text-[10.5px] tracking-[0.04em] text-muted">
          {right}
        </span>
      ) : null}
    </div>
  );
}

function WorkspaceRow({
  name,
  slug,
  role,
  continueUrl,
  subtitle,
  isMostRecent,
}: {
  name: string;
  slug: string;
  role: string;
  continueUrl: string;
  subtitle?: string;
  isMostRecent: boolean;
}) {
  const palette = avatarColor(slug);
  return (
    <a
      href={continueUrl}
      className={cn(
        "group flex items-center gap-3.5 rounded-md border-[0.5px] bg-card px-4 py-3 transition-colors",
        isMostRecent
          ? "border-gold hover:border-gold-deep"
          : "border-border-soft hover:border-forest hover:bg-card-warm",
      )}
    >
      <span
        className="grid size-11 place-items-center rounded-md font-sans text-[18px] font-semibold leading-none"
        style={{ background: palette.bg, color: palette.fg }}
      >
        {initial(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[14px] font-medium text-ink">{name}</span>
          {isMostRecent ? (
            <span className="rounded-full border-[0.5px] border-gold-deep bg-warning-bg px-2 py-0.5 text-[10.5px] font-medium text-warning-fg">
              Last opened
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1 font-mono text-[11.5px] text-subtle">
          <span aria-hidden className="text-muted">⌾</span>
          <span className="text-ink-warm">{slug}</span>
          <span className="text-muted">.fluxora.app</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11.5px]">
          <span className="inline-flex items-center gap-1.5 text-ink-warm">
            <span className="size-1.5 rounded-full bg-forest" />
            <span className="capitalize">{role}</span>
          </span>
          {subtitle ? (
            <>
              <span className="text-muted">·</span>
              <span className="text-subtle">{subtitle}</span>
            </>
          ) : null}
        </div>
      </div>
      <span
        aria-hidden
        className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-forest"
      >
        →
      </span>
    </a>
  );
}

function PlatformAdminRow({
  name,
  continueUrl,
  subtitle,
}: {
  name: string;
  continueUrl: string;
  subtitle?: string;
}) {
  return (
    <a
      href={continueUrl}
      className="group flex items-center gap-3.5 rounded-md border-[0.5px] border-gold-deep bg-card-warm px-4 py-3 transition-colors hover:bg-card"
    >
      <span
        className="grid size-11 place-items-center rounded-md font-sans text-[18px] font-semibold leading-none text-card-warm"
        style={{ background: "var(--color-gold-deep)" }}
      >
        F
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{name}</div>
        <div className="mt-0.5 flex items-center gap-1 font-mono text-[11.5px] text-subtle">
          <span aria-hidden className="text-muted">⌾</span>
          <span className="text-ink-warm">admin</span>
          <span className="text-muted">.fluxora.app</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-warm">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-gold-deep" />
            Platform admin
          </span>
          <span className="text-muted">·</span>
          <span className="text-subtle">{subtitle ?? "Cross-tenant access · audit logged"}</span>
        </div>
      </div>
      <span
        aria-hidden
        className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-forest"
      >
        →
      </span>
    </a>
  );
}
