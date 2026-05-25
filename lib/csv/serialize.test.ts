import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCsv } from "./parse";
import { serializeCsv } from "./serialize";

test("emits headers + rows; cells without special chars stay unquoted", () => {
  const csv = serializeCsv(
    [
      { key: "name", label: "Name" },
      { key: "age", label: "Age" },
    ],
    [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ],
  );
  assert.equal(csv, "Name,Age\nAlice,30\nBob,25\n");
});

test("quotes cells containing commas, quotes, or newlines", () => {
  const csv = serializeCsv(
    [
      { key: "co", label: "Company" },
      { key: "addr", label: "Address" },
    ],
    [
      { co: "Acme, Inc", addr: "123 Main St" },
      { co: "Acme", addr: 'He said "hi"' },
      { co: "Acme", addr: "Line 1\nLine 2" },
    ],
  );
  assert.match(csv, /^Company,Address\n/);
  assert.match(csv, /"Acme, Inc",123 Main St/);
  assert.match(csv, /Acme,"He said ""hi"""/);
  assert.match(csv, /Acme,"Line 1\nLine 2"/);
});

test("quotes cells with leading/trailing whitespace so parser can trim", () => {
  const csv = serializeCsv(
    [{ key: "n", label: "Name" }],
    [{ n: "  Acme  " }],
  );
  assert.match(csv, /"  Acme  "/);
});

test("renders null and undefined as empty cells", () => {
  const csv = serializeCsv(
    [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
      { key: "c", label: "C" },
    ],
    [{ a: "x", b: null, c: undefined }],
  );
  assert.equal(csv, "A,B,C\nx,,\n");
});

test("emits a header-only file when rows is empty", () => {
  const csv = serializeCsv(
    [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    [],
  );
  assert.equal(csv, "A,B\n");
});

test("round-trips through parseCsv (parser uses keys = labels here)", () => {
  // The serializer outputs LABELS as headers. To round-trip, the
  // parser uses those labels as object keys.
  const headers = [
    { key: "name", label: "Name" },
    { key: "note", label: "Note" },
  ] as const;
  const original = [
    { name: "Acme, Inc", note: "Says \"hi\"" },
    { name: "Other", note: "" },
  ];
  const csv = serializeCsv(headers, original);
  const { rows } = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.Name, "Acme, Inc");
  assert.equal(rows[0]!.Note, 'Says "hi"');
  assert.equal(rows[1]!.Name, "Other");
  assert.equal(rows[1]!.Note, "");
});
