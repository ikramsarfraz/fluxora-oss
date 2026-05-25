/**
 * Resolves the `From:` header used for any tenant-originated outbound
 * email — supplier-bill forwards (AP) and customer-invoice sends (AR)
 * both go through this. The shape is shared between the action that
 * actually sends and the preview action that powers the modal's helper
 * text, so recipient + sender see exactly the same thing.
 *
 * The local-part varies per channel via `kind`:
 *   - `bills`    — `{slug}-bills@…`    → AP forwards (default)
 *   - `invoices` — `{slug}-invoices@…` → AR sends
 *
 * Production: `"Display Name" <{slug}-{kind}@root-domain>` — same
 * verified domain in Resend across all tenants, local-part varies per
 * tenant + channel. No per-tenant Resend domain verification required.
 *
 * Non-prod: falls back to EMAIL_FROM (required by lib/email.ts at
 * boot). Resend free/hobby tiers usually only have one personal-domain
 * address verified, so forcing tenant-aware From in dev would hit
 * unverified-domain errors.
 *
 * EMAIL_FROM_OVERRIDE (prod-only) is a force-override useful for
 * staging / rollback to single-sender shape.
 *
 * Returns the full header string for the SMTP send, plus the bare
 * email for display in helper text.
 */
export type OutboundEmailKind = "bills" | "invoices";

export type ResolvedFromAddress = {
  /** Goes into Resend's `from:` field — display name + angle-bracketed email. */
  header: string;
  /** Just the address (for compact display in modal helper text). */
  email: string;
  /** The tenant brand name shown alongside the email in the recipient's inbox. */
  displayName: string | null;
};

/**
 * @deprecated Use `ResolvedFromAddress`. Kept as a type-only alias so
 * the old name in older imports still type-checks during cutover.
 */
export type ForwardFromAddress = ResolvedFromAddress;

/**
 * Tenant shape consumed by the helper. Matches what `getCurrentTenant`
 * returns (`branding` is the FK-joined tenant_branding row, optional
 * because new tenants exist before branding is filled in), plus the
 * tenants table's own `name` as a last-ditch fallback for the display
 * label.
 */
export type FromAddressTenantInput = {
  slug: string | null;
  /** From the tenants table itself — minimum guaranteed identifier. */
  name?: string | null;
  /** Joined tenant_branding row; both display + legal name live here. */
  branding?: {
    displayName: string | null;
    companyLegalName: string | null;
  } | null;
};

export function resolveOutboundFromAddress(
  tenant: FromAddressTenantInput,
  kind: OutboundEmailKind = "bills",
): ResolvedFromAddress {
  const isProd = process.env.NODE_ENV === "production";
  const rootDomain = process.env.ROOT_DOMAIN ?? "example.com";

  // Slug → safe local-part. Cap at 50 so the "-{kind}" suffix stays
  // under RFC 5321's 64-char local-part limit (`-invoices` is the longer
  // of the two suffixes at 9 chars; 50 + 9 = 59 < 64).
  const safeSlug = tenant.slug
    ?.toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const fromLocalPart = safeSlug ? `${safeSlug}-${kind}` : kind;

  // Display name — strip chars that would break the quoted header
  // (double quote, backslash, newline / CR). Order: branding.displayName
  // (the user-chosen brand label) → branding.companyLegalName (legal
  // entity) → tenants.name (the original workspace name set at signup).
  const rawDisplayName =
    tenant.branding?.displayName?.trim() ||
    tenant.branding?.companyLegalName?.trim() ||
    tenant.name?.trim() ||
    null;
  const safeDisplayName = rawDisplayName
    ? rawDisplayName.replace(/[\\"\r\n]/g, "").slice(0, 100)
    : null;

  const tenantAwareEmail = `${fromLocalPart}@${rootDomain}`;
  const tenantAwareHeader = safeDisplayName
    ? `"${safeDisplayName}" <${tenantAwareEmail}>`
    : tenantAwareEmail;

  // Resolve to the actual envelope used at send time.
  const headerOverride = isProd
    ? process.env.EMAIL_FROM_OVERRIDE
    : process.env.EMAIL_FROM;
  if (headerOverride) {
    return {
      header: headerOverride,
      // Extract the bare email when the override is `"Name" <addr>`,
      // otherwise treat the whole thing as an email.
      email: extractEmail(headerOverride),
      displayName: extractDisplayName(headerOverride),
    };
  }

  return {
    header: tenantAwareHeader,
    email: tenantAwareEmail,
    displayName: safeDisplayName,
  };
}

/**
 * @deprecated Use `resolveOutboundFromAddress(tenant, "bills")`. Kept so
 * existing supplier-invoice callers don't have to change in one PR.
 */
export function resolveForwardFromAddress(
  tenant: FromAddressTenantInput,
): ResolvedFromAddress {
  return resolveOutboundFromAddress(tenant, "bills");
}

function extractEmail(headerValue: string): string {
  const angled = headerValue.match(/<([^>]+)>/);
  return (angled?.[1] ?? headerValue).trim();
}

function extractDisplayName(headerValue: string): string | null {
  // "Display Name" <email@…>  OR  Display Name <email@…>
  const quoted = headerValue.match(/^\s*"([^"]+)"\s*<[^>]+>/);
  if (quoted) return quoted[1];
  const bare = headerValue.match(/^\s*([^<]+?)\s*<[^>]+>/);
  return bare ? bare[1].trim() : null;
}
