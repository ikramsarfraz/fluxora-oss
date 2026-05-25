// Pure domain-signal extraction and candidate pre-scoring for meat/food products.
// No server-only import — safe for tests and shared contexts.

import { normalizeProductName } from "./normalization";

// ---------------------------------------------------------------------------
// Domain vocabulary
// ---------------------------------------------------------------------------

const SPECIES_MAP: Array<[string, string[]]> = [
  ["beef",    ["beef"]],
  ["lamb",    ["lamb"]],
  ["goat",    ["goat"]],
  ["chicken", ["chicken"]],
  ["turkey",  ["turkey"]],
  ["veal",    ["veal"]],
  ["pork",    ["pork"]],
  ["duck",    ["duck"]],
];

// Canonical cut names after normalization (abbreviations already expanded by normalizeProductName)
const KNOWN_CUTS = new Set([
  "brisket", "shoulder", "rib", "leg", "loin", "shank",
  "liver", "feet", "neck", "breast", "tenderloin", "tender",
  "thigh", "drumstick", "wing", "chuck", "round", "sirloin",
  "flank", "strip", "ground", "rump", "oxtail", "tongue",
  "heart", "kidney", "tripe", "knuckle", "shin", "cutlet",
  "chop", "rack", "saddle", "whole",
]);

// ---------------------------------------------------------------------------
// Signal type
// ---------------------------------------------------------------------------

export type MeatProductSignals = {
  species: string[];
  cuts: string[];
  boneState: "bone_in" | "boneless" | null;
  freshness: "fresh" | "frozen" | null;
  origin: "imported" | "domestic" | null;
  tokens: string[];
};

// ---------------------------------------------------------------------------
// Extract signals from any product name string
// normalizeProductName() expands abbreviations first, so we work on canonical form
// ---------------------------------------------------------------------------

export function extractMeatProductSignals(rawName: string): MeatProductSignals {
  if (!rawName) {
    return { species: [], cuts: [], boneState: null, freshness: null, origin: null, tokens: [] };
  }

  const normalized = normalizeProductName(rawName);
  const tokens = normalized.split(" ").filter(Boolean);
  const tokenSet = new Set(tokens);

  const species = SPECIES_MAP
    .filter(([, kws]) => kws.some(kw => tokenSet.has(kw)))
    .map(([sp]) => sp);

  const cuts = [...KNOWN_CUTS].filter(c => tokenSet.has(c));

  // "bone in" is two tokens — check as substring in normalized string
  let boneState: "bone_in" | "boneless" | null = null;
  if (normalized.includes("bone in")) {
    boneState = "bone_in";
  } else if (tokenSet.has("boneless")) {
    boneState = "boneless";
  }

  const freshness = tokenSet.has("fresh") ? "fresh"
    : tokenSet.has("frozen") ? "frozen"
    : null;

  const origin = tokenSet.has("imported") ? "imported"
    : tokenSet.has("domestic") ? "domestic"
    : null;

  return { species, cuts, boneState, freshness, origin, tokens };
}

// ---------------------------------------------------------------------------
// Score a single candidate against vendor signals
// ---------------------------------------------------------------------------

export type CandidateSignalScore = {
  productId: string;
  score: number;
  reasons: string[];
};

export function scoreCandidateAgainstSignals(
  vendorSignals: MeatProductSignals,
  candidateSignals: MeatProductSignals,
  productId: string,
): CandidateSignalScore {
  let score = 0;
  const reasons: string[] = [];

  // Species: +20 match, -60 conflict (hard penalty — different animal is never right)
  if (vendorSignals.species.length > 0 && candidateSignals.species.length > 0) {
    const shared = vendorSignals.species.filter(s => candidateSignals.species.includes(s));
    if (shared.length > 0) {
      score += 20;
      reasons.push(`species:${shared.join(",")}`);
    } else {
      score -= 60;
      reasons.push(
        `species-conflict:vendor=[${vendorSignals.species}] product=[${candidateSignals.species}]`,
      );
    }
  }

  // Cut: +25 match, -30 conflict
  if (vendorSignals.cuts.length > 0 && candidateSignals.cuts.length > 0) {
    const shared = vendorSignals.cuts.filter(c => candidateSignals.cuts.includes(c));
    if (shared.length > 0) {
      score += 25;
      reasons.push(`cut:${shared.join(",")}`);
    } else {
      score -= 30;
      reasons.push(
        `cut-conflict:vendor=[${vendorSignals.cuts}] product=[${candidateSignals.cuts}]`,
      );
    }
  }

  // Bone state: +15 match, -30 conflict
  if (vendorSignals.boneState && candidateSignals.boneState) {
    if (vendorSignals.boneState === candidateSignals.boneState) {
      score += 15;
      reasons.push(`bone:${vendorSignals.boneState}`);
    } else {
      score -= 30;
      reasons.push(
        `bone-conflict:vendor=${vendorSignals.boneState} product=${candidateSignals.boneState}`,
      );
    }
  }

  // Freshness: +10 match (no penalty if only one side has it)
  if (
    vendorSignals.freshness &&
    candidateSignals.freshness &&
    vendorSignals.freshness === candidateSignals.freshness
  ) {
    score += 10;
    reasons.push(`freshness:${vendorSignals.freshness}`);
  }

  // Origin: +10 match
  if (
    vendorSignals.origin &&
    candidateSignals.origin &&
    vendorSignals.origin === candidateSignals.origin
  ) {
    score += 10;
    reasons.push(`origin:${vendorSignals.origin}`);
  }

  // Token overlap (Jaccard coefficient × 25 pts)
  if (vendorSignals.tokens.length > 0 && candidateSignals.tokens.length > 0) {
    const vSet = new Set(vendorSignals.tokens);
    const cSet = new Set(candidateSignals.tokens);
    const sharedCount = [...vSet].filter(t => cSet.has(t)).length;
    const unionSize = new Set([...vSet, ...cSet]).size;
    const pts = unionSize > 0 ? Math.round((sharedCount / unionSize) * 25) : 0;
    if (pts > 0) {
      score += pts;
      reasons.push(`tokens:${pts}pts`);
    }
  }

  return { productId, score, reasons };
}

// ---------------------------------------------------------------------------
// Select the top N candidates most relevant to any of the given vendor names.
// Used to filter the candidate list before sending to AI.
// ---------------------------------------------------------------------------

export const DEFAULT_PRESCORE_MAX_CANDIDATES = 30;

export type ScoredCandidate<T extends { id: string; name: string }> = {
  candidate: T;
  maxScore: number;
};

export function selectTopCandidatesForMatching<
  T extends { id: string; name: string; sku: string | null },
>(
  vendorNames: string[],
  candidates: T[],
  max = DEFAULT_PRESCORE_MAX_CANDIDATES,
): Array<{ candidate: T; maxScore: number; topReasons: string[] }> {
  if (candidates.length === 0 || vendorNames.length === 0) return [];

  const vendorSignals = vendorNames.map(n => extractMeatProductSignals(n));

  const scored = candidates.map(candidate => {
    const candSignals = extractMeatProductSignals(candidate.name);
    let maxScore = 0;
    let topReasons: string[] = [];
    for (const vs of vendorSignals) {
      const { score, reasons } = scoreCandidateAgainstSignals(vs, candSignals, candidate.id);
      if (score > maxScore) {
        maxScore = score;
        topReasons = reasons;
      }
    }
    return { candidate, maxScore, topReasons };
  });

  // Sort descending by score; take top N
  scored.sort((a, b) => b.maxScore - a.maxScore);
  return scored.slice(0, max);
}
