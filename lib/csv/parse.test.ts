import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCsv } from "./parse";

test("parses a basic header + rows", () => {
  const { headers, rows } = parseCsv("name,age\nAlice,30\nBob,25\n");
  assert.deepEqual(headers, ["name", "age"]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { name: "Alice", age: "30" });
  assert.deepEqual(rows[1], { name: "Bob", age: "25" });
});

test("respects quoted fields containing commas", () => {
  const { rows } = parseCsv('company,city\n"Acme, Inc",SF\n"Foo, Bar, Baz LLC",NYC\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.company, "Acme, Inc");
  assert.equal(rows[0]!.city, "SF");
  assert.equal(rows[1]!.company, "Foo, Bar, Baz LLC");
  assert.equal(rows[1]!.city, "NYC");
});

test("respects escaped double-quotes inside quoted fields", () => {
  const { rows } = parseCsv('quote,author\n"He said ""hi""",Alice\n');
  assert.equal(rows[0]!.quote, 'He said "hi"');
  assert.equal(rows[0]!.author, "Alice");
});

test("respects newlines inside quoted fields", () => {
  const { rows } = parseCsv('name,address\n"Acme","123 Main St\nSuite 5"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.address, "123 Main St\nSuite 5");
});

test("handles CRLF line endings", () => {
  const { headers, rows } = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
  assert.deepEqual(headers, ["a", "b"]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], { a: "3", b: "4" });
});

test("strips a UTF-8 BOM at the start of the file", () => {
  const { headers } = parseCsv("﻿name,age\nAlice,30\n");
  assert.deepEqual(headers, ["name", "age"]);
});

test("skips entirely blank lines but keeps empty cells", () => {
  const { rows } = parseCsv("a,b,c\n\n1,,3\n\n");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { a: "1", b: "", c: "3" });
});

test("trims outer whitespace on cells (including quoted fields)", () => {
  // Importers care about content, not padding. The previous .split(",")
  // parser also trimmed everywhere; we kept the behavior to avoid
  // breaking existing CSVs from spreadsheets that pad cells.
  const { rows } = parseCsv('name,note\n  Alice ,"  hello  "\n');
  assert.equal(rows[0]!.name, "Alice");
  assert.equal(rows[0]!.note, "hello");
});

test("returns empty result for empty or whitespace-only input", () => {
  assert.deepEqual(parseCsv(""), { headers: [], rows: [] });
  assert.deepEqual(parseCsv("   \n\n"), { headers: [], rows: [] });
});

test("ignores trailing missing columns gracefully (no header → empty)", () => {
  const { headers, rows } = parseCsv("a,b,c\n1,2\n");
  assert.deepEqual(headers, ["a", "b", "c"]);
  assert.equal(rows[0]!.a, "1");
  assert.equal(rows[0]!.b, "2");
  assert.equal(rows[0]!.c, "");
});
