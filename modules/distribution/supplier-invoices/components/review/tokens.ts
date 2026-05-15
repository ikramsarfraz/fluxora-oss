/**
 * OKLCH semantic colors used across the review redesign. The app's stone-*
 * tokens cover neutrals; these are the tone-coded accents not yet tokenized.
 */
export const REVIEW_COLORS = {
  accent: "oklch(58% 0.13 242)",
  accentSoft: "oklch(96% 0.02 242)",
  good: "oklch(58% 0.13 155)",
  goodSoft: "oklch(96% 0.03 155)",
  warn: "oklch(70% 0.16 70)",
  warnSoft: "oklch(96% 0.04 80)",
  danger: "oklch(58% 0.18 25)",
  dangerSoft: "oklch(96% 0.03 25)",
  mutedSoft: "#9a9a93",
  borderStrong: "#d4d1c7",
} as const;

export type ReviewTone = "good" | "warn" | "danger" | "fee";

export function toneColors(tone: ReviewTone, active: boolean) {
  switch (tone) {
    case "good":
      return {
        bar: REVIEW_COLORS.good,
        bg: active ? REVIEW_COLORS.goodSoft : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.good : "var(--stone-line)",
      };
    case "warn":
      return {
        bar: REVIEW_COLORS.warn,
        bg: active ? REVIEW_COLORS.warnSoft : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.warn : "var(--stone-line)",
      };
    case "danger":
      return {
        bar: REVIEW_COLORS.danger,
        bg: active ? REVIEW_COLORS.dangerSoft : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.danger : "var(--stone-line)",
      };
    case "fee":
      return {
        bar: REVIEW_COLORS.mutedSoft,
        bg: active ? "var(--stone-line2)" : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.borderStrong : "var(--stone-line)",
      };
  }
}
