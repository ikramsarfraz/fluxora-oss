import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getExpirationStateLabel,
  getInventoryStatusLabel,
  getLotOperationalStatusLabel,
  type ExpirationState,
  type InventoryLifecycleState,
  type LotOperationalStatus,
} from "@/lib/warehouse/insights";

function expirationClasses(state: ExpirationState) {
  switch (state) {
    case "expired":
      return "border-destructive/40 text-destructive";
    case "expiring_soon":
      return "border-amber-500/30 text-amber-700 dark:text-amber-400";
    case "fresh":
    default:
      return "border-emerald-500/30 text-emerald-700 dark:text-emerald-400";
  }
}

function inventoryClasses(status: InventoryLifecycleState) {
  switch (status) {
    case "allocated":
      return "border-amber-500/30 text-amber-700 dark:text-amber-400";
    case "picked":
      return "border-sky-500/30 text-sky-700 dark:text-sky-400";
    case "packed":
      return "border-indigo-500/30 text-indigo-700 dark:text-indigo-400";
    case "shipped":
      return "border-slate-500/30 text-slate-700 dark:text-slate-300";
    case "sold":
      return "border-emerald-500/30 text-emerald-700 dark:text-emerald-400";
    case "damaged":
    case "expired":
      return "border-destructive/40 text-destructive";
    case "in_stock":
    default:
      return "border-emerald-500/30 text-emerald-700 dark:text-emerald-400";
  }
}

export function ExpirationStateBadge({
  state,
}: {
  state: ExpirationState;
}) {
  return (
    <Badge variant="outline" className={cn(expirationClasses(state))}>
      {getExpirationStateLabel(state)}
    </Badge>
  );
}

export function InventoryStatusBadge({
  status,
}: {
  status: InventoryLifecycleState;
}) {
  return (
    <Badge variant="outline" className={cn(inventoryClasses(status))}>
      {getInventoryStatusLabel(status)}
    </Badge>
  );
}

export function LotOperationalStatusBadge({
  status,
}: {
  status: LotOperationalStatus;
}) {
  const classes =
    status === "mixed"
      ? "border-violet-500/30 text-violet-700 dark:text-violet-400"
      : status === "empty"
        ? "border-muted-foreground/30 text-muted-foreground"
        : inventoryClasses(status);

  return (
    <Badge variant="outline" className={cn(classes)}>
      {getLotOperationalStatusLabel(status)}
    </Badge>
  );
}
