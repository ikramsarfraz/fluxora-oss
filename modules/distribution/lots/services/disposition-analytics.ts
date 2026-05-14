// Pure analytics / computation functions — no server imports, safe to use in client components.

// ── Config types ──────────────────────────────────────────────────────────

export type MarkdownConfig = {
  discountPercent: number;
  newPrice: number;
  channels: Array<"clearance_list" | "food_trucks" | "recent_buyers" | "walk_in" | "marketplace">;
  notificationMethods: Array<"sms" | "email" | "in_app">;
  predictedSellThrough: number;
  predictedNet: number;
};

export type DonateConfig = {
  recipientName: string;
  pickupAt: string;
  taxDeduction: number;
  documentationGenerated: boolean;
};

export type OutreachConfig = {
  targetBuyerIds: string[];
  targetPrice: number;
};

export type RepurposeConfig = {
  targetProductId: string;
  processingNote: string;
};

export type DiscardConfig = {
  reason: string;
};

export type DispositionConfig =
  | MarkdownConfig
  | DonateConfig
  | OutreachConfig
  | RepurposeConfig
  | DiscardConfig;

// ── Expected-value computations ───────────────────────────────────────────

export type OptionExpectation = {
  option: "markdown" | "outreach" | "donate" | "repurpose" | "discard";
  expectedNet: number;
  lowEnd: number;
  highEnd: number;
  confidence: number;
  riskWeight: number;
  timeToSetUp: string;
  riskLevel: "low" | "variable" | "zero";
};

export function computeMarkdownExpectation(
  qtyLbs: number,
  landedCostPerLb: number,
  currentPricePerLb: number,
  discountPct: number,
  priorSellThroughAvg: number,
): OptionExpectation {
  const newPrice = currentPricePerLb * (1 - discountPct / 100);
  const revenue100 = newPrice * qtyLbs;
  const cost = landedCostPerLb * qtyLbs;

  const confidence = Math.min(0.9, priorSellThroughAvg > 0 ? 0.75 : 0.45);
  const expectedSell = priorSellThroughAvg > 0 ? priorSellThroughAvg : 0.65;
  const expectedNet = revenue100 * expectedSell - cost;
  const lowEnd = revenue100 * 0.4 - cost;
  const highEnd = revenue100 * 0.95 - cost;

  return {
    option: "markdown",
    expectedNet,
    lowEnd,
    highEnd,
    confidence,
    riskWeight: 0.3,
    timeToSetUp: "~10 min",
    riskLevel: "variable",
  };
}

export function computeDonateExpectation(
  qtyLbs: number,
  landedCostPerLb: number,
  taxRatePct = 21,
): OptionExpectation {
  const cost = landedCostPerLb * qtyLbs;
  const taxBenefit = cost * (taxRatePct / 100);
  const laborSavings = 5;
  const expectedNet = taxBenefit + laborSavings - cost;

  return {
    option: "donate",
    expectedNet,
    lowEnd: expectedNet * 0.85,
    highEnd: expectedNet * 1.05,
    confidence: 0.95,
    riskWeight: 0.0,
    timeToSetUp: "~5 min",
    riskLevel: "zero",
  };
}

export function computeOutreachExpectation(
  qtyLbs: number,
  landedCostPerLb: number,
  currentPricePerLb: number,
  buyerCount: number,
): OptionExpectation {
  const cost = landedCostPerLb * qtyLbs;
  const probSell = Math.min(0.9, buyerCount * 0.15);
  const expectedNet = currentPricePerLb * qtyLbs * probSell * 0.85 - cost;

  return {
    option: "outreach",
    expectedNet,
    lowEnd: expectedNet * 0.5,
    highEnd: currentPricePerLb * qtyLbs * 0.85 - cost,
    confidence: buyerCount > 0 ? 0.7 : 0.2,
    riskWeight: 0.25,
    timeToSetUp: "~15 min",
    riskLevel: "variable",
  };
}

export function computeRepurposeExpectation(
  qtyLbs: number,
  landedCostPerLb: number,
): OptionExpectation {
  const cost = landedCostPerLb * qtyLbs;
  const expectedNet = cost * 0.6 - cost * 0.2;

  return {
    option: "repurpose",
    expectedNet,
    lowEnd: expectedNet * 0.7,
    highEnd: expectedNet * 1.1,
    confidence: 0.6,
    riskWeight: 0.2,
    timeToSetUp: "~30 min",
    riskLevel: "variable",
  };
}

// ── Recommendation algorithm ──────────────────────────────────────────────

export type Recommendation =
  | { hidden: true; reason: string }
  | {
      hidden: false;
      option: OptionExpectation;
      priorCount: number;
      priorAvgSellThrough: number;
      allOptions: OptionExpectation[];
    };

export function recommendDisposition(
  options: OptionExpectation[],
  priorCount: number,
  priorAvgSellThrough: number,
): Recommendation {
  if (priorCount < 3) {
    return { hidden: true, reason: "cold_start" };
  }

  const scored = options.map(o => ({
    ...o,
    score: o.expectedNet * (1 - o.riskWeight * 0.15) * o.confidence,
  }));

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const secondBest = sorted[1];

  const maxScore = Math.max(...scored.map(o => o.score));
  const minScore = Math.min(...scored.map(o => o.score));
  if (maxScore > 0 && (maxScore - minScore) / maxScore < 0.1) {
    return { hidden: true, reason: "toss_up" };
  }

  if (secondBest && Math.abs(best.score - secondBest.score) / Math.abs(best.score) < 0.1) {
    return { hidden: true, reason: "too_close" };
  }

  return {
    hidden: false,
    option: best,
    priorCount,
    priorAvgSellThrough,
    allOptions: options,
  };
}

// ── Break-even computation ────────────────────────────────────────────────

export function computeBreakEvenDiscountPct(
  landedCostPerLb: number,
  currentPricePerLb: number,
): number {
  if (currentPricePerLb <= 0) return 0;
  const pct = ((currentPricePerLb - landedCostPerLb) / currentPricePerLb) * 100;
  return Math.max(0, Math.min(100, pct));
}

// ── Velocity computation ──────────────────────────────────────────────────

export type VelocityResult = {
  dailyAvgLbs: number;
  projectedSellLbs: number;
  shortfallLbs: number;
  willSellByExpiry: boolean;
};

export function computeVelocity(
  dailyAvgSoldLbs: number,
  hoursRemaining: number,
  qtyRemainingLbs: number,
): VelocityResult {
  const daysRemaining = hoursRemaining / 24;
  const projectedSellLbs = Math.min(dailyAvgSoldLbs * daysRemaining, qtyRemainingLbs);
  const shortfallLbs = Math.max(0, qtyRemainingLbs - projectedSellLbs);

  return {
    dailyAvgLbs: dailyAvgSoldLbs,
    projectedSellLbs,
    shortfallLbs,
    willSellByExpiry: shortfallLbs === 0,
  };
}

// ── Sell-through projection ───────────────────────────────────────────────

export type SellThroughProjection = {
  likelyPct: number;
  maybePct: number;
  wontClearPct: number;
  expectedSellThroughPct: number;
  expectedRevenue: number;
  residualQtyLbs: number;
  expectedNet: number;
};

export function computeSellThroughProjection(
  qtyLbs: number,
  newPricePerLb: number,
  landedCostPerLb: number,
  priorAvgSellThrough: number,
  confidence: number,
): SellThroughProjection {
  const expectedSellThroughPct = priorAvgSellThrough > 0 ? priorAvgSellThrough : 0.65;
  const variance = 1 - confidence;

  const likelyPct = Math.max(0, expectedSellThroughPct - variance * 0.2);
  const maybePct = Math.min(0.3, variance * 0.35);
  const wontClearPct = Math.max(0, 1 - likelyPct - maybePct);

  const expectedRevenue = newPricePerLb * qtyLbs * expectedSellThroughPct;
  const residualQtyLbs = qtyLbs * (1 - expectedSellThroughPct);
  const expectedNet = expectedRevenue - landedCostPerLb * qtyLbs;

  return {
    likelyPct,
    maybePct,
    wontClearPct,
    expectedSellThroughPct,
    expectedRevenue,
    residualQtyLbs,
    expectedNet,
  };
}
