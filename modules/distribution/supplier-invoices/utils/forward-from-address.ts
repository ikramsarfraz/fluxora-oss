/**
 * Resolves the `From:` header used when forwarding supplier bills. The
 * shape is shared between forwardBillAction (which actually sends) and
 * checkBillPdfAvailability (which previews to the modal's helper text)
 * so the recipient + the sender see exactly the same thing.
 *
 * Production: `"Display Name" <slug-bills@root-domain>` — same
 * verified domain in Resend across all tenants, local-part varies per
 * tenant. No per-tenant Resend domain verification required.
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
export type ForwardFromAddress = {
  /** Goes into Resend's `from:` field — display name + angle-bracketed email. */
  header: string;
  /** Just the address (for compact display in modal helper text). */
  email: string;
  /** The tenant brand name shown alongside the email in the recipient's inbox. */
  displayName: string | null;
};

export function resolveForwardFromAddress(tenant: {
  slug: string | null;
  displayName: string | null;
  companyLegalName: string | null;
}): ForwardFromAddress {
  const isProd = process.env.NODE_ENV === "production";
  const rootDomain = process.env.ROOT_DOMAIN ?? "example.com";

  // Slug → safe local-part. Cap at 50 so the "-bills" suffix stays
  // under RFC 5321's 64-char local-part limit.
  const safeSlug = tenant.slug
    ?.toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const fromLocalPart = safeSlug ? `${safeSlug}-bills` : "bills";

  // Display name — strip chars that would break the quoted header
  // (double quote, backslash, newline / CR).
  const rawDisplayName =
    tenant.displayName?.trim() || tenant.companyLegalName?.trim() || null;
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
