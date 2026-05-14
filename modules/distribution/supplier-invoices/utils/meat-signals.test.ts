import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractMeatProductSignals,
  scoreCandidateAgainstSignals,
  selectTopCandidatesForMatching,
  DEFAULT_PRESCORE_MAX_CANDIDATES,
} from "./meat-signals";

// ---------------------------------------------------------------------------
// extractMeatProductSignals
// ---------------------------------------------------------------------------

test("extractMeatProductSignals: detects species from plain name", () => {
  const s = extractMeatProductSignals("LAMB SHOULDER");
  assert.deepEqual(s.species, ["lamb"]);
});

test("extractMeatProductSignals: detects multiple species if somehow both present", () => {
  const s = extractMeatProductSignals("BEEF AND LAMB MIX");
  assert.ok(s.species.includes("beef"));
  assert.ok(s.species.includes("lamb"));
});

test("extractMeatProductSignals: expands shldr abbreviation to shoulder (cut)", () => {
  const s = extractMeatProductSignals("LAMB SHLDR B/I");
  assert.ok(s.cuts.includes("shoulder"), "should detect shoulder cut");
});

test("extractMeatProductSignals: detects bone_in from b/i abbreviation", () => {
  const s = extractMeatProductSignals("LAMB SHLDR B/I IMP");
  assert.equal(s.boneState, "bone_in");
});

test("extractMeatProductSignals: detects boneless from bnls abbreviation", () => {
  const s = extractMeatProductSignals("CHICKEN BNLS BRST");
  assert.equal(s.boneState, "boneless");
  assert.ok(s.cuts.includes("breast"));
  assert.deepEqual(s.species, ["chicken"]);
});

test("extractMeatProductSignals: detects boneless from b/l abbreviation", () => {
  const s = extractMeatProductSignals("BEEF B/L BRISKET");
  assert.equal(s.boneState, "boneless");
  assert.ok(s.cuts.includes("brisket"));
});

test("extractMeatProductSignals: detects imported from imp abbreviation", () => {
  const s = extractMeatProductSignals("GOAT LEG IMP");
  assert.equal(s.origin, "imported");
  assert.ok(s.cuts.includes("leg"));
  assert.deepEqual(s.species, ["goat"]);
});

test("extractMeatProductSignals: detects frozen from frz abbreviation", () => {
  const s = extractMeatProductSignals("BEEF BRISKET FRZ");
  assert.equal(s.freshness, "frozen");
});

test("extractMeatProductSignals: detects fresh", () => {
  const s = extractMeatProductSignals("FRESH CHICKEN BREAST");
  assert.equal(s.freshness, "fresh");
});

test("extractMeatProductSignals: detects turkey with turk abbreviation", () => {
  const s = extractMeatProductSignals("WHOLE TURK");
  assert.ok(s.species.includes("turkey"), "turk should expand to turkey");
});

test("extractMeatProductSignals: handles empty string", () => {
  const s = extractMeatProductSignals("");
  assert.deepEqual(s.species, []);
  assert.deepEqual(s.cuts, []);
  assert.equal(s.boneState, null);
  assert.equal(s.freshness, null);
  assert.equal(s.origin, null);
  assert.deepEqual(s.tokens, []);
});

test("extractMeatProductSignals: tokens are normalized lowercase words", () => {
  const s = extractMeatProductSignals("JUMBO CHICKEN TENDER");
  assert.ok(s.tokens.includes("chicken"));
  assert.ok(s.tokens.includes("tender"));
  assert.ok(s.tokens.includes("jumbo"));
});

test("extractMeatProductSignals: detects cut from full name", () => {
  const s = extractMeatProductSignals("BEEF BRISKET BONELESS");
  assert.ok(s.cuts.includes("brisket"));
  assert.equal(s.boneState, "boneless");
  assert.deepEqual(s.species, ["beef"]);
});

test("extractMeatProductSignals: detects multiple cuts if present", () => {
  const s = extractMeatProductSignals("LAMB SHOULDER AND LEG");
  assert.ok(s.cuts.includes("shoulder"));
  assert.ok(s.cuts.includes("leg"));
});

// ---------------------------------------------------------------------------
// scoreCandidateAgainstSignals
// ---------------------------------------------------------------------------

test("scoreCandidateAgainstSignals: matching species gives positive score", () => {
  const vendor = extractMeatProductSignals("LAMB SHOULDER B/I");
  const product = extractMeatProductSignals("Lamb Shoulder Bone-In");
  const result = scoreCandidateAgainstSignals(vendor, product, "p1");
  assert.ok(result.score > 0, "same species+cut+bonestate should score positive");
  assert.ok(result.reasons.some(r => r.includes("species")));
});

test("scoreCandidateAgainstSignals: conflicting species gives hard negative", () => {
  const vendor = extractMeatProductSignals("LAMB SHOULDER");
  const product = extractMeatProductSignals("BEEF SHOULDER");
  const result = scoreCandidateAgainstSignals(vendor, product, "p1");
  assert.ok(result.score < 0, "conflicting species should give negative score");
  assert.ok(result.reasons.some(r => r.includes("species-conflict")));
});

test("scoreCandidateAgainstSignals: conflicting bone state gives penalty", () => {
  const vendor = extractMeatProductSignals("LAMB SHOULDER B/I");
  const product = extractMeatProductSignals("LAMB SHOULDER BONELESS");
  const result = scoreCandidateAgainstSignals(vendor, product, "p1");
  // Species matches (+20), bone state conflicts (-30) → net negative for bone
  assert.ok(result.reasons.some(r => r.includes("bone-conflict")));
  assert.ok(result.score < 30, "bone conflict should reduce score significantly");
});

test("scoreCandidateAgainstSignals: conflicting cut gives penalty", () => {
  const vendor = extractMeatProductSignals("BEEF BRISKET");
  const product = extractMeatProductSignals("BEEF SHOULDER");
  const result = scoreCandidateAgainstSignals(vendor, product, "p1");
  assert.ok(result.reasons.some(r => r.includes("cut-conflict")));
});

test("scoreCandidateAgainstSignals: exact same product scores highest", () => {
  const vendor = extractMeatProductSignals("BEEF BRISKET BONELESS IMP");
  const perfect = extractMeatProductSignals("BEEF BRISKET BONELESS IMPORTED");
  const wrongSpecies = extractMeatProductSignals("LAMB BRISKET BONELESS IMP");
  const perfect_score = scoreCandidateAgainstSignals(vendor, perfect, "p1").score;
  const wrong_score = scoreCandidateAgainstSignals(vendor, wrongSpecies, "p2").score;
  assert.ok(perfect_score > wrong_score, "perfect match should outscore wrong species");
});

test("scoreCandidateAgainstSignals: no signals on either side gives token overlap score", () => {
  const vendor = extractMeatProductSignals("JUMBO PACK SPECIAL");
  const product = extractMeatProductSignals("JUMBO PACK DELUXE");
  const result = scoreCandidateAgainstSignals(vendor, product, "p1");
  // No species/cut/bone, but shared "jumbo" and "pack" tokens → positive token overlap
  assert.ok(result.score >= 0);
  assert.ok(result.reasons.some(r => r.startsWith("tokens:")));
});

test("scoreCandidateAgainstSignals: freshness match gives bonus", () => {
  const vendor = extractMeatProductSignals("FRESH LAMB LEG");
  const fresh = extractMeatProductSignals("FRESH LAMB LEG");
  const frozen = extractMeatProductSignals("FROZEN LAMB LEG");
  const freshScore = scoreCandidateAgainstSignals(vendor, fresh, "p1").score;
  const frozenScore = scoreCandidateAgainstSignals(vendor, frozen, "p2").score;
  assert.ok(freshScore > frozenScore, "matching freshness should score higher");
});

test("scoreCandidateAgainstSignals: origin match gives bonus", () => {
  const vendor = extractMeatProductSignals("LAMB SHOULDER IMP");
  const imp = extractMeatProductSignals("LAMB SHOULDER IMPORTED");
  const dom = extractMeatProductSignals("LAMB SHOULDER DOMESTIC");
  const impScore = scoreCandidateAgainstSignals(vendor, imp, "p1").score;
  const domScore = scoreCandidateAgainstSignals(vendor, dom, "p2").score;
  assert.ok(impScore > domScore, "matching origin should score higher");
});

// ---------------------------------------------------------------------------
// selectTopCandidatesForMatching
// ---------------------------------------------------------------------------

const makeCandidate = (id: string, name: string, sku: string | null = null) => ({
  id,
  name,
  sku,
});

test("selectTopCandidatesForMatching: returns at most max candidates", () => {
  const candidates = Array.from({ length: 100 }, (_, i) =>
    makeCandidate(`p${i}`, `Product ${i}`),
  );
  const result = selectTopCandidatesForMatching(["LAMB SHOULDER"], candidates, 10);
  assert.equal(result.length, 10);
});

test("selectTopCandidatesForMatching: uses default max", () => {
  const candidates = Array.from({ length: 100 }, (_, i) =>
    makeCandidate(`p${i}`, `Product ${i}`),
  );
  const result = selectTopCandidatesForMatching(["LAMB SHOULDER"], candidates);
  assert.equal(result.length, DEFAULT_PRESCORE_MAX_CANDIDATES);
});

test("selectTopCandidatesForMatching: wrong-species candidates score low and are deprioritized", () => {
  const candidates = [
    makeCandidate("beef-1", "Beef Shoulder Boneless"),
    makeCandidate("lamb-1", "Lamb Shoulder Bone-In"),
    makeCandidate("chicken-1", "Chicken Breast Boneless"),
  ];
  const result = selectTopCandidatesForMatching(["LAMB SHLDR B/I"], candidates, 3);
  // lamb-1 should be ranked first
  assert.equal(result[0].candidate.id, "lamb-1");
  // beef gets cut penalty, chicken gets species conflict
  const lambScore = result.find(r => r.candidate.id === "lamb-1")?.maxScore ?? -999;
  const beefScore = result.find(r => r.candidate.id === "beef-1")?.maxScore ?? -999;
  const chickenScore = result.find(r => r.candidate.id === "chicken-1")?.maxScore ?? -999;
  assert.ok(lambScore > beefScore, "lamb should outscore beef for lamb vendor name");
  assert.ok(lambScore > chickenScore, "lamb should outscore chicken for lamb vendor name");
});

test("selectTopCandidatesForMatching: empty candidates returns empty", () => {
  const result = selectTopCandidatesForMatching(["LAMB"], [], 10);
  assert.deepEqual(result, []);
});

test("selectTopCandidatesForMatching: empty vendor names returns empty", () => {
  const candidates = [makeCandidate("p1", "Lamb Shoulder")];
  const result = selectTopCandidatesForMatching([], candidates, 10);
  assert.deepEqual(result, []);
});

test("selectTopCandidatesForMatching: multiple vendor names — union of top matches", () => {
  const candidates = [
    makeCandidate("lamb-leg", "Lamb Leg Bone-In"),
    makeCandidate("lamb-shoulder", "Lamb Shoulder Boneless"),
    makeCandidate("beef-brisket", "Beef Brisket Boneless"),
    makeCandidate("chicken-breast", "Chicken Breast Boneless"),
  ];
  const vendorNames = ["LAMB LEG B/I", "LAMB SHLDR BNLS"];
  const result = selectTopCandidatesForMatching(vendorNames, candidates, 4);
  const ids = result.map(r => r.candidate.id);
  // Both lamb candidates should score high
  assert.ok(ids.includes("lamb-leg"), "lamb-leg should be in top candidates");
  assert.ok(ids.includes("lamb-shoulder"), "lamb-shoulder should be in top candidates");
});

test("selectTopCandidatesForMatching: results sorted by score descending", () => {
  const candidates = [
    makeCandidate("exact", "Lamb Shoulder Bone-In Imported"),
    makeCandidate("partial", "Lamb Shoulder"),
    makeCandidate("wrong", "Beef Shoulder Bone-In"),
  ];
  const result = selectTopCandidatesForMatching(["LAMB SHLDR B/I IMP"], candidates, 3);
  // Scores should be non-increasing
  for (let i = 1; i < result.length; i++) {
    assert.ok(
      result[i - 1].maxScore >= result[i].maxScore,
      "results should be sorted by score descending",
    );
  }
});

// ---------------------------------------------------------------------------
// Abbreviation expansion correctness (relies on normalizeProductName from normalization.ts)
// ---------------------------------------------------------------------------

test("b/l expands to boneless — detected as boneless boneState", () => {
  assert.equal(extractMeatProductSignals("LAMB B/L LEG").boneState, "boneless");
});

test("bone-in hyphenated form detected", () => {
  assert.equal(extractMeatProductSignals("LAMB BONE-IN SHOULDER").boneState, "bone_in");
});

test("chkn abbreviation detected as chicken", () => {
  const s = extractMeatProductSignals("CHKN THGH B/L");
  assert.ok(s.species.includes("chicken"), "chkn should be detected as chicken");
  assert.ok(s.cuts.includes("thigh"), "thgh should expand to thigh");
  assert.equal(s.boneState, "boneless");
});
