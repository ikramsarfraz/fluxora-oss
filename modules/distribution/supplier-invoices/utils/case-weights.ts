export const supplierInvoiceWeightEntryModes = [
  "total_weight",
  "default_case_weight",
  "manual_case_weights",
] as const;

export type SupplierInvoiceWeightEntryMode =
  (typeof supplierInvoiceWeightEntryModes)[number];

type CaseWeightDraftLike = {
  unitType?: "catch_weight" | "fixed_case" | null;
  quantityCases?: string | number | null;
  weightLbs?: string | number | null;
  weightEntryMode?: SupplierInvoiceWeightEntryMode | null;
  defaultCaseWeightLbs?: string | number | null;
  caseWeightEntries?: Array<string | number | null | undefined> | null;
};

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = value ? parseFloat(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo(weight: number): number {
  return Number(weight.toFixed(4));
}

export function formatEditableWeight(weight: number): string {
  const rounded = roundTo(weight);
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(4).replace(/\.?0+$/, "");
}

export function parsePersistedCaseWeights(
  raw: string | null | undefined,
): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(value => roundTo(toNumber(value as string | number | null)))
      .filter(weight => weight > 0);
  } catch {
    return [];
  }
}

function getQuantityCases(value: string | number | null | undefined): number {
  const quantity =
    typeof value === "number"
      ? value
      : value
        ? Number.parseInt(value, 10)
        : 0;
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
}

export function getResolvedDraftCaseWeights(line: CaseWeightDraftLike): number[] {
  if (line.unitType !== "catch_weight") return [];

  const quantity = getQuantityCases(line.quantityCases);
  if (quantity <= 0) return [];

  const mode = line.weightEntryMode ?? "total_weight";
  if (mode === "total_weight") return [];

  const entries = line.caseWeightEntries ?? [];
  const defaultWeight = toNumber(line.defaultCaseWeightLbs);

  return Array.from({ length: quantity }, (_, index) => {
    const explicitWeight = toNumber(entries[index]);
    if (explicitWeight > 0) return roundTo(explicitWeight);
    if (mode === "default_case_weight" && defaultWeight > 0) {
      return roundTo(defaultWeight);
    }
    return 0;
  }).filter(weight => weight > 0);
}

export function computeDraftLineWeight(line: CaseWeightDraftLike): number {
  if (line.unitType !== "catch_weight") {
    return toNumber(line.weightLbs);
  }

  const mode = line.weightEntryMode ?? "total_weight";
  if (mode === "total_weight") {
    return roundTo(toNumber(line.weightLbs));
  }

  return roundTo(
    getResolvedDraftCaseWeights(line).reduce((sum, weight) => sum + weight, 0),
  );
}

export function serializeDraftCaseWeights(
  line: CaseWeightDraftLike,
): string | null {
  if (line.unitType !== "catch_weight") return null;
  const mode = line.weightEntryMode ?? "total_weight";
  if (mode === "total_weight") return null;

  const resolved = getResolvedDraftCaseWeights(line);
  if (resolved.length === 0) return null;
  return JSON.stringify(resolved.map(weight => roundTo(weight)));
}

export function inferWeightDraftState(args: {
  unitType: "catch_weight" | "fixed_case";
  quantityCases: number;
  weightLbs: string | null;
  caseWeightsLbs: string | null;
}): {
  weightEntryMode: SupplierInvoiceWeightEntryMode;
  defaultCaseWeightLbs: string;
  caseWeightEntries: string[];
} {
  if (args.unitType !== "catch_weight") {
    return {
      weightEntryMode: "total_weight",
      defaultCaseWeightLbs: "",
      caseWeightEntries: [],
    };
  }

  const quantity = Math.max(0, args.quantityCases);
  const weights = parsePersistedCaseWeights(args.caseWeightsLbs).slice(0, quantity);

  if (quantity <= 0 || weights.length !== quantity || weights.length === 0) {
    return {
      weightEntryMode: "total_weight",
      defaultCaseWeightLbs: "",
      caseWeightEntries: Array.from({ length: quantity }, () => ""),
    };
  }

  const frequency = new Map<string, number>();
  for (const weight of weights) {
    const key = weight.toFixed(4);
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }

  const [mostCommonKey, mostCommonCount] =
    [...frequency.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  if (!mostCommonKey || !mostCommonCount) {
    return {
      weightEntryMode: "manual_case_weights",
      defaultCaseWeightLbs: "",
      caseWeightEntries: weights.map(formatEditableWeight),
    };
  }

  const defaultWeight = parseFloat(mostCommonKey);
  const uniqueWeights = frequency.size;

  if (uniqueWeights === 1 || mostCommonCount >= Math.max(2, quantity - 1)) {
    return {
      weightEntryMode: "default_case_weight",
      defaultCaseWeightLbs: formatEditableWeight(defaultWeight),
      caseWeightEntries: weights.map(weight =>
        Math.abs(weight - defaultWeight) < 0.0001 ? "" : formatEditableWeight(weight),
      ),
    };
  }

  return {
    weightEntryMode: "manual_case_weights",
    defaultCaseWeightLbs: "",
    caseWeightEntries: weights.map(formatEditableWeight),
  };
}

export function summarizePersistedCaseWeights(weights: number[]): string | null {
  if (weights.length === 0) return null;
  const uniqueWeights = new Set(weights.map(weight => weight.toFixed(4)));

  if (uniqueWeights.size === 1) {
    return `${weights.length} case${weights.length === 1 ? "" : "s"} @ ${formatEditableWeight(weights[0])} lbs`;
  }

  const preview = weights.slice(0, 3).map(formatEditableWeight).join(" / ");
  const suffix =
    weights.length > 3 ? ` +${weights.length - 3} more` : "";

  return `${weights.length} case weights: ${preview}${suffix}`;
}

export function inferPersistedCaseWeightPattern(
  weights: number[],
): "shared_default" | "manual" | null {
  if (weights.length === 0) return null;

  const frequency = new Map<string, number>();
  for (const weight of weights) {
    const key = weight.toFixed(4);
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }

  const mostCommonCount =
    [...frequency.values()].sort((a, b) => b - a)[0] ?? 0;

  if (frequency.size === 1 || mostCommonCount >= Math.max(2, weights.length - 1)) {
    return "shared_default";
  }

  return "manual";
}
