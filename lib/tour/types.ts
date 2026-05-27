/**
 * Shared types for the product-tour system. Step shapes match the original
 * cold-start tour — `live` steps spotlight a DOM target, `done` steps render
 * a centered "you're set" card with a primary CTA.
 *
 * Selectors can be any valid `document.querySelector` string. The convention
 * in this codebase is `[data-tour-target="xxx"]` so step targets stay clearly
 * intentional (not piggy-backing on application-meaningful ids that might
 * change). Existing dashboard steps still use `#welcomeBanner` etc. — both
 * work because the ProductTour just feeds the selector into querySelector.
 */

export type TourStepPlacement = "top" | "right" | "bottom" | "left";

export type TourStepHint = {
  /** Lucide icon name or literal glyph for the hint badge. */
  icon: string;
  /** HTML allowed: <strong>, <em>, <kbd>. */
  text: string;
};

export type TourLiveStep = {
  kind: "live";
  /** CSS selector handed to `document.querySelector`. */
  target: string;
  placement: TourStepPlacement;
  pad?: number;
  /** "Step 1 · Customer". */
  label: string;
  title: string;
  /** HTML allowed: <strong>, <em>, <kbd>. */
  text: string;
  hint?: TourStepHint;
};

export type TourDoneStep = {
  kind: "done";
  label: string;
  title: string;
  text: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export type TourStep = TourLiveStep | TourDoneStep;
