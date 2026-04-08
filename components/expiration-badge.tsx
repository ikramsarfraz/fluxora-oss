import { formatDisplayDate } from "@/lib/utils/date";

/**
 * FEFO: show expiration date with "expiring soon" vs "ok" badge.
 */
interface ExpirationBadgeProps {
  expirationDate: string;
}

function parseDate(s: string): Date {
  return new Date(s + "T12:00:00Z");
}

export function ExpirationBadge({ expirationDate }: ExpirationBadgeProps) {
  const exp = parseDate(expirationDate);
  const now = new Date();
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const label = `Expires ${formatDisplayDate(expirationDate)}`;
  let badgeClass = "badge ok";
  if (daysLeft < 0) badgeClass = "badge expired";
  else if (daysLeft <= 7) badgeClass = "badge soon";
  return (
    <span className={badgeClass} title={label}>
      {label}
    </span>
  );
}
