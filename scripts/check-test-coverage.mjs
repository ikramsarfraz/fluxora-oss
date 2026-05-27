#!/usr/bin/env node
// Verify every *.test.ts file on disk is listed in package.json's test:unit
// script. The script hardcodes its file list (it's a single `node --test`
// invocation, no glob); without this check, a freshly-added test file is
// silently uncovered until someone notices.
//
// Run via: node scripts/check-test-coverage.mjs
//      or: pnpm check:tests
//
// Exits 1 with a diff when drift exists. Exits 0 silently when everything
// matches. Designed to be safe to wire into CI as a pre-merge gate.

import { readFileSync, readdirSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// Directories we scan for test files. Mirrors what `package.json`'s
// test:unit script already references. Keeps the script's blast radius
// tight — nothing under node_modules, .next, .git, etc. gets walked.
const SCAN_DIRS = ["lib", "modules", "scripts"];
const TEST_FILE_REGEX = /\.test\.ts$/;

function* walkTestFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Missing scan dir — skip silently. Empty repos shouldn't fail.
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    if (entry.name.startsWith(".")) continue; // .next, .turbo, etc.
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTestFiles(full);
    } else if (TEST_FILE_REGEX.test(entry.name)) {
      yield full;
    }
  }
}

function loadDeclaredTests() {
  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const script = pkg.scripts?.["test:unit"];
  if (typeof script !== "string") {
    throw new Error(
      "package.json scripts.test:unit is missing — can't compare against on-disk tests.",
    );
  }
  // The script's arguments are space-separated paths after the runner flags.
  // We extract every token that ends with `.test.ts`; anything else
  // (`node`, `--conditions=react-server`, etc.) is ignored.
  const declared = new Set();
  for (const token of script.split(/\s+/)) {
    if (TEST_FILE_REGEX.test(token)) declared.add(normalize(token));
  }
  return declared;
}

function normalize(p) {
  return p.split(sep).join("/");
}

function collectOnDiskTests() {
  const onDisk = new Set();
  for (const scanDir of SCAN_DIRS) {
    for (const abs of walkTestFiles(join(ROOT, scanDir))) {
      onDisk.add(normalize(relative(ROOT, abs)));
    }
  }
  return onDisk;
}

function diffSets(onDisk, declared) {
  const missing = [];
  const extraneous = [];
  for (const f of onDisk) if (!declared.has(f)) missing.push(f);
  for (const f of declared) if (!onDisk.has(f)) extraneous.push(f);
  missing.sort();
  extraneous.sort();
  return { missing, extraneous };
}

const onDisk = collectOnDiskTests();
const declared = loadDeclaredTests();
const { missing, extraneous } = diffSets(onDisk, declared);

if (missing.length === 0 && extraneous.length === 0) {
  console.log("check:tests — all *.test.ts files are wired into test:unit.");
  process.exit(0);
}

if (missing.length > 0) {
  console.error(
    `${missing.length} test file${missing.length === 1 ? "" : "s"} on disk but NOT in package.json scripts.test:unit:`,
  );
  for (const f of missing) console.error(`  + ${f}`);
  console.error();
}
if (extraneous.length > 0) {
  console.error(
    `${extraneous.length} entr${extraneous.length === 1 ? "y" : "ies"} in scripts.test:unit but NOT on disk (stale references):`,
  );
  for (const f of extraneous) console.error(`  - ${f}`);
  console.error();
}
console.error(
  "Fix the drift by appending missing files to scripts.test:unit in package.json (and/or removing stale ones).",
);
process.exit(1);
