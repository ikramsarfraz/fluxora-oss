/**
 * Auth user display names: combined name for UI and legacy Better Auth `user.name`.
 */

export function composeFullName(first: string, last: string): string {
  const f = first.trim();
  const l = last.trim();
  if (f && l) {
    return `${f} ${l}`;
  }
  return f || l;
}

/** Fallback split when only a single blob is available (invite / OAuth). */
export function splitLooseDisplayName(blob: string): {
  firstName: string;
  lastName: string;
} {
  const t = blob.trim();
  if (!t) {
    return { firstName: "", lastName: "" };
  }
  const i = t.indexOf(" ");
  if (i === -1) {
    return { firstName: t, lastName: "" };
  }
  return {
    firstName: t.slice(0, i).trim(),
    lastName: t.slice(i + 1).trim(),
  };
}

export type AuthNameFields = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
};

/**
 * Display fallback: fullName → composed first+last → legacy name → email local-part.
 */
export function formatAuthUserDisplayName(input: AuthNameFields): string {
  const full = input.fullName?.trim();
  if (full) {
    return full;
  }
  const fromParts = composeFullName(
    input.firstName ?? "",
    input.lastName ?? "",
  );
  if (fromParts) {
    return fromParts;
  }
  const legacy = input.name?.trim();
  if (legacy) {
    return legacy;
  }
  const mail = input.email?.trim();
  if (mail) {
    return mail.split("@")[0] ?? mail;
  }
  return "";
}
