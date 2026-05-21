export type InventoryLifecycleState =
  | "in_stock"
  | "allocated"
  | "picked"
  | "packed"
  | "shipped"
  | "sold"
  | "damaged"
  | "expired";

export type ExpirationState = "fresh" | "expiring_soon" | "expired";

export type LotOperationalStatus =
  | InventoryLifecycleState
  | "mixed"
  | "empty";

const ACTIVE_INVENTORY_STATES: InventoryLifecycleState[] = [
  "in_stock",
  "allocated",
  "picked",
  "packed",
];

export function getExpirationState(
  expirationDate: string | Date | null | undefined,
  warningDays = 1,
): ExpirationState {
  if (!expirationDate) return "fresh";

  const rawDate =
    expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(rawDate.getTime())) return "fresh";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const expiration = new Date(
    rawDate.getFullYear(),
    rawDate.getMonth(),
    rawDate.getDate(),
  );

  if (expiration.getTime() < startOfToday.getTime()) {
    return "expired";
  }

  const warningThreshold = new Date(startOfToday);
  warningThreshold.setDate(warningThreshold.getDate() + warningDays);
  return expiration.getTime() <= warningThreshold.getTime()
    ? "expiring_soon"
    : "fresh";
}

export function getExpirationStateLabel(state: ExpirationState): string {
  switch (state) {
    case "expired":
      return "Expired";
    case "expiring_soon":
      return "Expiring soon";
    case "fresh":
    default:
      return "Fresh";
  }
}

export function getInventoryStatusLabel(
  status: InventoryLifecycleState | null | undefined,
): string {
  switch (status) {
    case "allocated":
      return "Allocated";
    case "picked":
      return "Picked";
    case "packed":
      return "Packed";
    case "shipped":
      return "Shipped";
    case "sold":
      return "Sold";
    case "damaged":
      return "Damaged";
    case "expired":
      return "Expired";
    case "in_stock":
    default:
      return "In stock";
  }
}

export function getLotOperationalStatus(args: {
  inventoryStatuses: Array<InventoryLifecycleState | null | undefined>;
  expirationDate: string | Date | null | undefined;
}): LotOperationalStatus {
  const statuses = args.inventoryStatuses.filter(
    (status): status is InventoryLifecycleState => Boolean(status),
  );

  if (statuses.length === 0) {
    return "empty";
  }

  const uniqueStatuses = [...new Set(statuses)];
  const expirationState = getExpirationState(args.expirationDate);

  if (expirationState === "expired" && statuses.some(isInventoryOpenStatus)) {
    return "expired";
  }

  if (uniqueStatuses.length === 1) {
    return uniqueStatuses[0];
  }

  if (
    statuses.every(status => status === "shipped" || status === "sold") &&
    statuses.some(status => status === "shipped")
  ) {
    return "shipped";
  }

  return "mixed";
}

export function getLotOperationalStatusLabel(
  status: LotOperationalStatus,
): string {
  if (status === "mixed") return "Mixed";
  if (status === "empty") return "Empty";
  return getInventoryStatusLabel(status);
}

export function isInventoryOpenStatus(
  status: InventoryLifecycleState | null | undefined,
): boolean {
  if (!status) return false;
  return ACTIVE_INVENTORY_STATES.includes(status);
}

export function sumNumericStrings(values: Array<string | null | undefined>) {
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function formatWeightLbs(value: string | number | null | undefined) {
  return (Number(value) || 0).toFixed(2);
}

/**
 * Family-aware quantity renderer for an inventory-items row. Replaces
 * the old "Weight (lb)" column which only made sense for catch-weight
 * meat. Now:
 *   - Catch-weight & fixed-case items: render "{weight} {baseAbbr}" so
 *     mixed-UOM catalogs (lb meat + kg seafood) display each row in its
 *     own unit.
 *   - Per-each / per-unit items: weight is meaningless — render
 *     "{cases} {baseAbbr}" (one row = one unit/case in the base UOM).
 * Falls back to "{weight} lb" for legacy rows that don't carry a
 * cost-unit-type snapshot.
 */
export function formatInventoryQuantity(args: {
  costUnitTypeSnapshot:
    | "catch_weight"
    | "fixed_case"
    | "per_each"
    | "per_unit"
    | null;
  exactWeightLbs: string | number | null | undefined;
  cases: number | null | undefined;
  baseUnitAbbreviation: string | null | undefined;
}): string {
  const baseAbbr = args.baseUnitAbbreviation?.trim() || null;
  const isWeightMode =
    args.costUnitTypeSnapshot === "catch_weight" ||
    args.costUnitTypeSnapshot === "fixed_case" ||
    args.costUnitTypeSnapshot == null; // legacy default → assume weight

  if (isWeightMode) {
    const weight = Number(args.exactWeightLbs) || 0;
    return `${weight.toFixed(2)} ${baseAbbr ?? "lb"}`;
  }
  const cases = Number(args.cases) || 0;
  return `${cases} ${baseAbbr ?? "ea"}`;
}
