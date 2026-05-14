import { cn } from "@/lib/utils";
import type { PortalUserRole } from "@/lib/auth/permissions";

/**
 * 22×22px rounded-square icon with the role's initial.
 * System roles get semantic colour pairs per the design handoff:
 *  - owner → indigo (accent)
 *  - admin → blue (info)
 *  - others → per-role palette so they don't all blur together
 */
export function RoleIcon({
  role,
  active = false,
  size = 22,
}: {
  role: PortalUserRole;
  active?: boolean;
  size?: 22 | 28;
}) {
  const initial = role.charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md text-[11px] font-semibold",
        active && "ring-1 ring-primary/30",
      )}
      style={{
        width: size,
        height: size,
        background: PALETTE[role].bg,
        color: PALETTE[role].fg,
      }}
    >
      {initial}
    </span>
  );
}

const PALETTE: Record<PortalUserRole, { bg: string; fg: string }> = {
  owner: { bg: "oklch(96% 0.02 265)", fg: "oklch(48% 0.16 265)" },
  admin: { bg: "oklch(96% 0.03 240)", fg: "oklch(60% 0.15 240)" },
  sales: { bg: "oklch(94% 0.08 60)", fg: "oklch(45% 0.16 60)" },
  warehouse: { bg: "oklch(94% 0.06 30)", fg: "oklch(55% 0.18 25)" },
  accounting: { bg: "oklch(94% 0.06 150)", fg: "oklch(58% 0.13 155)" },
};
