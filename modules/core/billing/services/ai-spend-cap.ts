// Pure helpers — no DB, no server-only imports — so the threshold logic
// is unit-testable without spinning up the full billing stack. The live
// reader + the action-layer gate live in sibling files; this module only
// owns the "given used + limit, what's the verdict" decision.

/** Below this ratio, the call goes through quietly. */
export const AI_SPEND_WARN_RATIO = 0.8;
/** At or above this ratio, the call is hard-blocked until the period rolls. */
export const AI_SPEND_BLOCK_RATIO = 1.0;

export type AiSpendCapStatus = "ok" | "warn" | "blocked";

export type AiSpendCapDecision = {
  status: AiSpendCapStatus;
  usedMicros: number;
  /**
   * Plan limit in micro-USD. Number.POSITIVE_INFINITY when the tenant's plan
   * carries no AI cap (enterprise / comped) — the decision then collapses
   * to `"ok"` regardless of usage.
   */
  limitMicros: number;
  /**
   * `used / limit`, clamped to [0, 1] when finite. Null when the limit is
   * unlimited — UI surfaces a "no cap" affordance rather than a progress
   * bar in that case.
   */
  ratio: number | null;
};

/**
 * Pure decision: given a (used, limit) pair from the live reader, return
 * the status band the action layer should act on. Defensive against
 * non-finite / negative inputs:
 *   - negative `used` → treated as 0 (impossible from real data; defensive
 *     against a writer regression)
 *   - non-finite `limit` → no cap, always "ok"
 *   - `limit <= 0` → treated as no cap (a plan accidentally configured
 *     with a zero limit shouldn't lock out every parse; warn-only in
 *     dashboard is the safer fallback)
 */
export function decideAiSpendStatus(args: {
  usedMicros: number;
  limitMicros: number;
}): AiSpendCapDecision {
  const used = Number.isFinite(args.usedMicros) && args.usedMicros > 0
    ? args.usedMicros
    : 0;
  const limit = args.limitMicros;

  if (!Number.isFinite(limit) || limit <= 0) {
    return { status: "ok", usedMicros: used, limitMicros: limit, ratio: null };
  }

  const ratio = used / limit;
  let status: AiSpendCapStatus;
  if (ratio >= AI_SPEND_BLOCK_RATIO) status = "blocked";
  else if (ratio >= AI_SPEND_WARN_RATIO) status = "warn";
  else status = "ok";

  return { status, usedMicros: used, limitMicros: limit, ratio };
}

/**
 * Custom error thrown by the action-layer gate when the decision is
 * `"blocked"`. Carrying the decision lets the catch site format a
 * user-facing message with the actual numbers without re-running the
 * reader.
 */
export class AiSpendCapError extends Error {
  readonly code = "ai_spend_capped" as const;
  readonly decision: AiSpendCapDecision;
  constructor(decision: AiSpendCapDecision) {
    super(
      `AI usage cap reached for this billing period ` +
        `(used $${(decision.usedMicros / 1_000_000).toFixed(2)} of ` +
        `$${(decision.limitMicros / 1_000_000).toFixed(2)}). ` +
        `Resets at the start of the next calendar month.`,
    );
    this.name = "AiSpendCapError";
    this.decision = decision;
  }
}
