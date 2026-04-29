/**
 * Node built-in runner with TypeScript via tsx (`devDependency`).
 * Run: npm run test:unit
 */
import assert from "node:assert/strict";
import test from "node:test";

import { composeFullName, formatAuthUserDisplayName, splitLooseDisplayName } from "./user-display-name";

test("composeFullName joins or returns single part", () => {
  assert.equal(composeFullName("Ada", "Lovelace"), "Ada Lovelace");
  assert.equal(composeFullName("Madonna", ""), "Madonna");
  assert.equal(composeFullName("", "  "), "");
});

test("splitLooseDisplayName handles one or two parts", () => {
  assert.deepEqual(splitLooseDisplayName("Jean Claude"), {
    firstName: "Jean",
    lastName: "Claude",
  });
  assert.deepEqual(splitLooseDisplayName("solo"), { firstName: "solo", lastName: "" });
});

test("formatAuthUserDisplayName respects preference order", () => {
  assert.equal(
    formatAuthUserDisplayName({
      fullName: "Full",
      firstName: "A",
      name: "Legacy",
      email: "u@x.com",
    }),
    "Full",
  );
  assert.equal(
    formatAuthUserDisplayName({
      firstName: "A",
      lastName: "B",
      email: "u@x.com",
    }),
    "A B",
  );
  assert.equal(
    formatAuthUserDisplayName({
      name: "Only",
      email: "hi@y.com",
    }),
    "Only",
  );
});
