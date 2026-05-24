/**
 * Pure pair-detection for intra-bank transfers.
 *
 * Given a tenant's recent posted bank transactions, find pairs where one
 * leg is the matching opposite of another (outflow on account A + inflow
 * on account B, same magnitude, same currency, within a small date window).
 * Returns the {a, b} ids plus a generated pair id for each match.
 *
 * Doesn't touch the DB. The caller decides what to do with the pairings
 * (typically: UPDATE both rows to share the pair id).
 *
 * Heuristic rules:
 *   - Different bank_account_id (transfers are between accounts)
 *   - Opposite signs (one positive outflow, one negative inflow)
 *   - Same absolute amount, within 1 cent for rounding noise
 *   - Same ISO currency
 *   - Dates within +/- DEFAULT_WINDOW_DAYS (transfers settle quickly)
 *   - Neither already paired (caller filters before passing in)
 *   - Greedy: each leg is paired at most once; closest-date wins on ties
 */

export type TransferCandidate = {
  id: string;
  bankAccountId: string;
  /** Signed amount: positive = outflow (money leaving), negative = inflow. */
  amount: number;
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  isoCurrencyCode: string;
};

export type DetectedPair = {
  outflowId: string;
  inflowId: string;
  pairId: string;
};

const DEFAULT_WINDOW_DAYS = 3;
const AMOUNT_TOLERANCE_CENTS = 1; // 1 cent — absorbs both rounding noise and
                                   // the occasional 1c bank fee differential.

function daysApart(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / 86_400_000;
}

/** Compare two dollar amounts in cents so floating-point noise can't flip a match. */
function centsDiffer(a: number, b: number, toleranceCents: number): boolean {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100)) > toleranceCents;
}

export function detectTransferPairs(
  candidates: TransferCandidate[],
  options?: {
    windowDays?: number;
    generatePairId?: () => string;
  },
): DetectedPair[] {
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const generatePairId =
    options?.generatePairId ??
    (() =>
      // Stable enough for production via crypto; tests inject a counter.
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `pair-${Math.random().toString(36).slice(2)}`);

  const outflows = candidates.filter(c => c.amount > 0);
  const inflows = candidates.filter(c => c.amount < 0);

  // Sort outflows by date so deterministic pairing falls out: oldest first
  // gets first dibs, mirroring how the bank reports postings.
  const sortedOutflows = [...outflows].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id),
  );

  const claimedInflowIds = new Set<string>();
  const pairs: DetectedPair[] = [];

  for (const out of sortedOutflows) {
    let best: { inflow: TransferCandidate; dateDistance: number } | null = null;
    for (const inflow of inflows) {
      if (claimedInflowIds.has(inflow.id)) continue;
      if (inflow.bankAccountId === out.bankAccountId) continue;
      if (inflow.isoCurrencyCode !== out.isoCurrencyCode) continue;
      if (centsDiffer(Math.abs(inflow.amount), out.amount, AMOUNT_TOLERANCE_CENTS)) continue;
      const distance = daysApart(out.date, inflow.date);
      if (distance > windowDays) continue;
      if (!best || distance < best.dateDistance) {
        best = { inflow, dateDistance: distance };
      }
    }
    if (best) {
      claimedInflowIds.add(best.inflow.id);
      pairs.push({
        outflowId: out.id,
        inflowId: best.inflow.id,
        pairId: generatePairId(),
      });
    }
  }

  return pairs;
}
