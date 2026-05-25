const PRODUCT_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bshldrs\b/gi, "shoulder"],
  [/\bshldr\b/gi, "shoulder"],
  [/\bshlder\b/gi, "shoulder"],
  [/\bshld\b/gi, "shoulder"],
  [/\bb\/i\b/gi, "bone in"],
  [/\bbone-in\b/gi, "bone in"],
  [/\bb\/l\b/gi, "boneless"],
  [/\bbnls\b/gi, "boneless"],
  [/\bbnless\b/gi, "boneless"],
  [/\bimp\b/gi, "imported"],
  [/\bfrz\b/gi, "frozen"],
  [/\bfrzn\b/gi, "frozen"],
  [/\bwhl\b/gi, "whole"],
  [/\bcs\b/gi, "case"],
  [/\blbs?\b/gi, "lb"],
  [/\bcw\b/gi, "catch weight"],
  [/\bexp\b/gi, "export"],
  [/\bfresh\b/gi, "fresh"],
  [/\bfrzn\b/gi, "frozen"],
  [/\bpc\b/gi, "piece"],
  [/\bpcs\b/gi, "pieces"],
  [/\bqty\b/gi, "quantity"],
  [/\bwt\b/gi, "weight"],
  [/\bhal\b/gi, "halal"],
  [/\bchick\b/gi, "chicken"],
  [/\bchkn\b/gi, "chicken"],
  [/\bbrst\b/gi, "breast"],
  [/\bthgh\b/gi, "thigh"],
  [/\bthighs\b/gi, "thigh"],
  [/\bwing\b/gi, "wing"],
  [/\bdrum\b/gi, "drumstick"],
  [/\bgrnd\b/gi, "ground"],
  [/\bbeef\b/gi, "beef"],
  [/\blamb\b/gi, "lamb"],
  [/\bgoat\b/gi, "goat"],
  [/\bveal\b/gi, "veal"],
  [/\bturk\b/gi, "turkey"],
  [/\bduck\b/gi, "duck"],
  [/\brib\b/gi, "rib"],
  [/\bloin\b/gi, "loin"],
  [/\bchuck\b/gi, "chuck"],
  [/\brnd\b/gi, "round"],
  [/\bsirloin\b/gi, "sirloin"],
  [/\bbrisket\b/gi, "brisket"],
  [/\bshank\b/gi, "shank"],
  [/\bflank\b/gi, "flank"],
  [/\btender\b/gi, "tender"],
  [/\bnugget\b/gi, "nugget"],
  [/\bstripps?\b/gi, "strip"],
];

const BUSINESS_SUFFIXES =
  /\b(llc|inc|co|company|ltd|corp|corporation)\b/gi;

const PLURAL_EXCEPTIONS = new Set([
  "boneless", "skinless", "weightless", "priceless", "endless",
  "express", "cross", "class", "grass", "mass", "pass", "bass",
]);

function stemToken(token: string): string {
  if (token.length <= 3) return token;
  if (PLURAL_EXCEPTIONS.has(token)) return token;
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("ves") && token.length > 4) return token.slice(0, -3) + "f";
  if (token.endsWith("ses") || token.endsWith("xes") || token.endsWith("zes")) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function normalizeProductName(name: string): string {
  if (!name) return "";
  let result = name.toLowerCase().trim();
  for (const [pattern, replacement] of PRODUCT_ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(stemToken)
    .join(" ");
}

export function normalizeSupplierName(name: string): string {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(BUSINESS_SUFFIXES, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeInvoiceNumber(value: string): string {
  if (!value) return "";
  return value.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
}

export function normalizeWeightString(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num.toFixed(4) : "";
}

export function normalizeCurrencyString(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num.toFixed(2) : "";
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function fuzzyScore(candidate: string, target: string): number {
  if (!candidate || !target) return 0;
  const a = normalizeProductName(candidate);
  const b = normalizeProductName(target);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 85;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = b.split(" ").filter(Boolean);
  const aTokenArr = [...aTokens];
  if (bTokens.length > 0 && aTokenArr.length > 0) {
    const overlap = bTokens.filter(t => aTokens.has(t)).length;
    const ratioB = overlap / bTokens.length;
    const ratioA = overlap / aTokenArr.length;
    const ratio = Math.max(ratioA, ratioB);
    if (ratio === 1) return 75;
    if (ratio >= 0.6) return Math.round(60 * ratio);
    // Partial overlap (40–59%): return a low-confidence score so the match surfaces
    // in the review panel for human confirmation without auto-filling the form.
    if (ratio >= 0.4) return Math.round(48 * ratio);
  }

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const dist = levenshteinDistance(a, b);
  const similarity = 1 - dist / maxLen;
  if (similarity >= 0.8) return Math.round(50 * similarity);

  return 0;
}
