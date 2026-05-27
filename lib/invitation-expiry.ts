// Pure helpers for the per-tenant invitation expiry window (#236). No
// DB, no server-only imports — the resolver runs in tests, in actions,
// and at write time inside the auth + invitations services. The single
// source of truth for "how long does a fresh invite live?".

/** Codebase default when a tenant hasn't picked its own value. */
export const INVITATION_EXPIRY_DAYS_DEFAULT = 7;
/** Minimum bound. Anything shorter is operationally hostile (the
 *  invitee gets the email + has to react within a workday). */
export const INVITATION_EXPIRY_DAYS_MIN = 1;
/** Maximum bound. Longer windows let a leaked invite link sit live
 *  longer than the security audit comfortably allows. */
export const INVITATION_EXPIRY_DAYS_MAX = 30;

/**
 * Resolve the effective expiry-window days for a tenant — falling back
 * to the codebase default when the column is null (existing tenants
 * pre-#236) AND clamping to [MIN, MAX] so a sneaky direct-DB update
 * can't extend windows past 30 days or shrink to zero.
 *
 * Pure on purpose: the writers (inviteUser, resendUserInvitationByAdmin)
 * pass in the tenant row's column value; the action / UI layer feeds
 * the same helper with raw user input so the clamping rule is enforced
 * in exactly one place.
 */
export function resolveInvitationExpiryDays(
  raw: number | null | undefined,
): number {
  if (raw == null || !Number.isFinite(raw)) {
    return INVITATION_EXPIRY_DAYS_DEFAULT;
  }
  // Truncate first so "7.9" doesn't sneak past the clamp as 8.
  const integer = Math.trunc(raw);
  if (integer < INVITATION_EXPIRY_DAYS_MIN) return INVITATION_EXPIRY_DAYS_MIN;
  if (integer > INVITATION_EXPIRY_DAYS_MAX) return INVITATION_EXPIRY_DAYS_MAX;
  return integer;
}

/**
 * Compute the `expires_at` timestamp for a new / resent invitation,
 * given the tenant's configured window. Pure for the same reason as
 * the resolver — the writers stay testable without freezing the
 * `Date` constructor.
 *
 * `now` is injectable so the test can pin a fixed instant; production
 * paths omit it and the helper picks `new Date()`.
 */
export function invitationExpiryAt(args: {
  configuredDays: number | null | undefined;
  now?: Date;
}): Date {
  const days = resolveInvitationExpiryDays(args.configuredDays);
  const now = args.now ?? new Date();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
