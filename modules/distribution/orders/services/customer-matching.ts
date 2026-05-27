// Deterministic customer matcher for the AI-paste flow.
//
// Pure util: takes a `hint` (the AI-extracted customerHint or the user's raw
// reference) and a candidate list (caller's responsibility to fetch from the
// DB), returns the best match plus a small candidate set with confidence
// scores. No `server-only` import so this can be unit-tested without the
// React-server condition.
//
// Why deterministic instead of AI for this surface:
//  - Customer hints are mostly short business names ("City Diner"); fuzzy
//    name matching is well-handled by classical normalization + Levenshtein.
//  - An AI call here would cost ~1¢/parse for what `searchCustomers` does
//    instantly. Reserve AI cost for the order extraction itself.
//  - When pgvector lands (issue #244), swap the internals of this function
//    out for a cosine query — the call sites + return shape stay stable.

const BUSINESS_SUFFIX_TOKENS = new Set([
  "llc",
  "inc",
  "co",
  "company",
  "corp",
  "corporation",
  "ltd",
  "limited",
  "pllc",
  "lp",
  "llp",
]);

// Generic stop-tokens — short connector words that add noise to the
// token-overlap score without helping disambiguation. Intentionally short
// list: anything domain-specific should stay in the name.
const STOP_TOKENS = new Set(["the", "and", "of", "a", "an"]);

function normalizeCustomerName(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(t => t.length > 0 && !BUSINESS_SUFFIX_TOKENS.has(t) && !STOP_TOKENS.has(t))
    .join(" ");
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
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

// Score 0-100. The bands mirror `fuzzyScore` in supplier-invoices'
// normalization util so confidence chips feel consistent across both
// AI-paste surfaces:
//
//   exact normalized match              → 100
//   one fully contains the other        →  85
//   100% token overlap                  →  75
//   ≥60% token overlap                  → 36-75 (scaled)
//   ≥40% token overlap                  → 19-29 (low-confidence review)
//   Levenshtein similarity ≥0.8         → 40-50
//   anything else                       →   0
function scoreCandidate(hint: string, candidate: string): number {
  const a = normalizeCustomerName(hint);
  const b = normalizeCustomerName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 85;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = b.split(" ").filter(Boolean);
  if (bTokens.length > 0 && aTokens.size > 0) {
    const overlap = bTokens.filter(t => aTokens.has(t)).length;
    const ratio = Math.max(overlap / bTokens.length, overlap / aTokens.size);
    if (ratio === 1) return 75;
    if (ratio >= 0.6) return Math.round(60 * ratio);
    if (ratio >= 0.4) return Math.round(48 * ratio);
  }

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const similarity = 1 - levenshteinDistance(a, b) / maxLen;
  if (similarity >= 0.8) return Math.round(50 * similarity);
  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CustomerMatchCandidate = {
  id: string;
  name: string;
  confidence: number;
};

export type CustomerMatchResult = {
  suggestedCustomerId: string | null;
  /** Sorted by confidence desc, max 3 entries. The suggested customer
   *  (when one exists) is the first entry. */
  candidates: CustomerMatchCandidate[];
  /** Confidence of the top match. 0 when no candidate scored above the floor. */
  confidence: number;
};

const AUTO_FILL_THRESHOLD = 80;
const MIN_REPORTABLE_SCORE = 20;
const MAX_CANDIDATES_RETURNED = 3;

/**
 * Score a customer hint against the given candidate list and return:
 *   - `suggestedCustomerId`: the top candidate's id if score ≥ 80, else null.
 *     The "auto-fill threshold" lines up with the AI's confidence semantics
 *     (>80 = high confidence) so the form's customer field only auto-fills
 *     when both signals agree.
 *   - `candidates`: top-3 candidates with score ≥ 20, sorted desc. Below 20
 *     is noise — the user is faster to just open the customer dropdown.
 *
 * Caller's responsibility to fetch the candidate list (typically the tenant's
 * active customers; the action layer in PR 2 will pull from `searchCustomers`
 * or a tenant-scoped customer query).
 */
export function matchCustomerByName(
  hint: string | null | undefined,
  candidates: Array<{ id: string; name: string }>,
): CustomerMatchResult {
  if (!hint || hint.trim().length === 0 || candidates.length === 0) {
    return { suggestedCustomerId: null, candidates: [], confidence: 0 };
  }

  const scored: CustomerMatchCandidate[] = candidates
    .map(c => ({
      id: c.id,
      name: c.name,
      confidence: scoreCandidate(hint, c.name),
    }))
    .filter(c => c.confidence >= MIN_REPORTABLE_SCORE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CANDIDATES_RETURNED);

  const top = scored[0];
  if (!top) {
    return { suggestedCustomerId: null, candidates: [], confidence: 0 };
  }

  return {
    suggestedCustomerId:
      top.confidence >= AUTO_FILL_THRESHOLD ? top.id : null,
    candidates: scored,
    confidence: top.confidence,
  };
}

// Exposed for tests + future callers that want to score a single pair
// (e.g. computing a similarity column in a debug view).
export const _internal = {
  normalizeCustomerName,
  scoreCandidate,
  AUTO_FILL_THRESHOLD,
};
