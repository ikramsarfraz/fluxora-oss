// Per-model OpenAI pricing → cost-in-micros math. Lives in utils/ so the
// admin page can compute display dollars without pulling in the provider
// graph (no `server-only` here).
//
// Prices are denominated as USD per 1M tokens, matching OpenAI's public
// pricing tables. Update both rows when OpenAI rebalances. Models not in
// the table get cost = 0 — better to show "we don't know the cost yet"
// than to invent a number.

/**
 * Map exact model id → { input, output } price in USD per 1M tokens. Source:
 * platform.openai.com/docs/pricing. Last reviewed against the late-2025
 * pricing tier. The admin page calls this out so reviewers know to refresh
 * after any OpenAI pricing change.
 */
const MODEL_PRICING_USD_PER_1M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  // Add other models here as we expand. Vision and text share the same
  // pricing on these endpoints.
};

const MICROS_PER_DOLLAR = 1_000_000;

/**
 * Compute the cost of one OpenAI call in micro-dollars (1/1,000,000 of USD).
 * Integer return so the database can store + aggregate without float drift.
 *
 * Returns 0 when the model isn't in our pricing table — better than guessing.
 * Surfacing zero-cost rows in the admin page is the visible signal that the
 * pricing table needs updating.
 */
export function calculateAiCostMicros(args: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[args.model];
  if (!pricing) return 0;

  // Tokens × ($/1M tokens) × (1M micros/$) ÷ (1M tokens/M tokens)
  //                                                ^^^^^^^^^^^^^^^^
  //                                                ^^^^^^^^^^^^^^^^
  // Simplifies to: tokens × $/1M-tokens × 1 micro per token-millionth.
  // Multiply by 10^6 micros-per-USD and divide by 10^6 tokens-per-1M-tokens.
  const inputMicros = args.promptTokens * pricing.input;
  const outputMicros = args.completionTokens * pricing.output;
  return Math.round(inputMicros + outputMicros);
}

/**
 * Convert micros → display-formatted USD ("$0.000123", "$1.23", "$1,234.56").
 * The admin page shows totals; per-row costs are typically sub-cent.
 */
export function formatAiUsageCost(micros: number): string {
  const dollars = micros / MICROS_PER_DOLLAR;
  if (dollars === 0) return "$0";
  if (dollars < 0.01) return `$${dollars.toFixed(6)}`;
  if (dollars < 1) return `$${dollars.toFixed(4)}`;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * Whether the given model has a known cost. Useful for surfacing "unknown
 * pricing" warnings in the admin page when an environment overrides
 * OPENAI_*_MODEL to a model we haven't priced yet.
 */
export function isKnownModel(model: string): boolean {
  return model in MODEL_PRICING_USD_PER_1M_TOKENS;
}

/**
 * Exported for tests + admin documentation — the source of truth on which
 * models we know how to bill for.
 */
export const KNOWN_MODELS = Object.keys(MODEL_PRICING_USD_PER_1M_TOKENS);
