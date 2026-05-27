import assert from "node:assert/strict";
import { test } from "node:test";

import { _internal, matchCustomerByName } from "./customer-matching";

const { normalizeCustomerName, scoreCandidate, AUTO_FILL_THRESHOLD } = _internal;

test("normalizeCustomerName strips suffixes, punctuation, and stop tokens", () => {
  assert.equal(normalizeCustomerName("The City Diner, LLC"), "city diner");
  assert.equal(normalizeCustomerName("Joe & Sons Corp."), "joe sons");
  assert.equal(normalizeCustomerName("Brewer's Steakhouse Inc"), "brewer s steakhouse");
  assert.equal(normalizeCustomerName(""), "");
});

test("scoreCandidate gives 100 for exact normalized match", () => {
  assert.equal(scoreCandidate("City Diner", "CITY DINER"), 100);
  assert.equal(scoreCandidate("City Diner LLC", "City Diner"), 100);
});

test("scoreCandidate gives 85 for substring containment", () => {
  // After normalization "downtown city diner" contains "city diner" → 85.
  assert.equal(scoreCandidate("Downtown City Diner", "City Diner"), 85);
  assert.equal(scoreCandidate("City Diner", "Downtown City Diner"), 85);
});

test("scoreCandidate handles token overlap below containment", () => {
  // "city grill restaurant" vs "city restaurant" — 100% of target tokens
  // present in candidate → ratio = 1 → 75. (Not containment because token
  // order differs and neither full string is a substring of the other.)
  const score = scoreCandidate("City Grill Restaurant", "City Restaurant");
  assert.ok(score >= 75 && score <= 100, `expected >=75, got ${score}`);
});

test("scoreCandidate returns 0 for unrelated names", () => {
  assert.equal(scoreCandidate("City Diner", "Brewer Livestock"), 0);
});

test("matchCustomerByName returns no suggestion when hint is empty", () => {
  const result = matchCustomerByName(null, [
    { id: "c1", name: "City Diner" },
  ]);
  assert.equal(result.suggestedCustomerId, null);
  assert.equal(result.candidates.length, 0);

  const result2 = matchCustomerByName("   ", [{ id: "c1", name: "City Diner" }]);
  assert.equal(result2.suggestedCustomerId, null);
});

test("matchCustomerByName returns no suggestion when candidate list is empty", () => {
  const result = matchCustomerByName("City Diner", []);
  assert.equal(result.suggestedCustomerId, null);
  assert.equal(result.candidates.length, 0);
});

test("matchCustomerByName auto-fills when top score ≥ 80", () => {
  const result = matchCustomerByName("City Diner", [
    { id: "c1", name: "Joe's Pizza" },
    { id: "c2", name: "City Diner" },
    { id: "c3", name: "Brewer Livestock" },
  ]);
  assert.equal(result.suggestedCustomerId, "c2");
  assert.equal(result.confidence, 100);
  assert.equal(result.candidates[0].id, "c2");
});

test("matchCustomerByName surfaces candidates without auto-fill below threshold", () => {
  // "Diner" alone vs "City Diner" — token overlap 1/2 of target = 50% ratio
  // → 24 (above MIN_REPORTABLE_SCORE=20, below AUTO_FILL_THRESHOLD=80).
  const result = matchCustomerByName("Diner Joe", [
    { id: "c1", name: "City Diner" },
    { id: "c2", name: "Brewer Livestock" },
  ]);
  assert.equal(result.suggestedCustomerId, null);
  assert.ok(
    result.confidence > 0 && result.confidence < AUTO_FILL_THRESHOLD,
    `expected score between 0 and ${AUTO_FILL_THRESHOLD}, got ${result.confidence}`,
  );
});

test("matchCustomerByName returns at most 3 candidates sorted by confidence desc", () => {
  const candidates = [
    { id: "c1", name: "City Diner" },
    { id: "c2", name: "City Diner Express" },
    { id: "c3", name: "Downtown City Diner" },
    { id: "c4", name: "City Diner Annex" },
    { id: "c5", name: "Brewer Livestock" },
  ];
  const result = matchCustomerByName("City Diner", candidates);
  assert.ok(result.candidates.length <= 3);
  for (let i = 1; i < result.candidates.length; i++) {
    assert.ok(
      result.candidates[i - 1].confidence >= result.candidates[i].confidence,
      "candidates should be sorted by confidence desc",
    );
  }
});

test("matchCustomerByName filters out below-noise scores", () => {
  // "xyzzy" matches nothing — should produce no candidates.
  const result = matchCustomerByName("xyzzy frobnitz", [
    { id: "c1", name: "City Diner" },
    { id: "c2", name: "Brewer Livestock" },
  ]);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.suggestedCustomerId, null);
});

test("matchCustomerByName ignores business suffixes when comparing", () => {
  // "City Diner LLC" vs "City Diner" → both normalize identically → 100.
  const result = matchCustomerByName("City Diner LLC", [
    { id: "c1", name: "City Diner" },
  ]);
  assert.equal(result.suggestedCustomerId, "c1");
  assert.equal(result.confidence, 100);
});
