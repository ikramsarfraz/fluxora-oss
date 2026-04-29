export const publicSupportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@pelzersolutions.com";

export function buildPublicSupportMailto(subject?: string): string {
  if (!subject) {
    return `mailto:${publicSupportEmail}`;
  }

  return `mailto:${publicSupportEmail}?${new URLSearchParams({
    subject,
  }).toString()}`;
}
