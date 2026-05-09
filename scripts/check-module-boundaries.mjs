#!/usr/bin/env node
// Lightweight import boundary checker. Fails on hard violations; warns on soft ones.
// Run via: node scripts/check-module-boundaries.mjs
//   or:    npm run check:boundaries

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// ──────────────────────────────────────────────────────────────────────────────
// Rules
// ──────────────────────────────────────────────────────────────────────────────

const HARD_VIOLATIONS = [
  {
    // modules must not import from app/
    filePattern: /^modules\//,
    importPattern: /@\/app\//,
    message: "modules/** must not import from @/app/",
  },
  {
    // distribution must not import from app/
    filePattern: /^modules\/distribution\//,
    importPattern: /@\/app\//,
    message: "modules/distribution/** must not import from @/app/",
  },
  {
    // core must not import from distribution
    filePattern: /^modules\/core\//,
    importPattern: /@\/modules\/distribution\//,
    message: "modules/core/** must not import from @/modules/distribution/",
  },
  {
    // shared must not import from distribution
    filePattern: /^modules\/shared\//,
    importPattern: /@\/modules\/distribution\//,
    message: "modules/shared/** must not import from @/modules/distribution/",
  },
  {
    // nobody should import from root @/services/ or @/actions/
    filePattern: /^(modules|app|lib)\//,
    importPattern: /from ["']@\/services\/|from ["']@\/actions\//,
    message: "Do not import from root @/services/ or @/actions/ — import from the owning module instead",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// File walker
// ──────────────────────────────────────────────────────────────────────────────

function* walkFiles(dir, extensions = [".ts", ".tsx"]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Import extractor — crude but fast; handles most real-world cases
// ──────────────────────────────────────────────────────────────────────────────

const IMPORT_RE = /(?:import|export)(?:\s+[\w*{},\s]+\s+from\s+|\s*\()?\s*["']([^"']+)["']/g;

function extractImports(source) {
  const imports = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

let hardCount = 0;

for (const absPath of walkFiles(ROOT)) {
  const rel = relative(ROOT, absPath);

  let source;
  try {
    source = readFileSync(absPath, "utf8");
  } catch {
    continue;
  }

  const imports = extractImports(source);

  for (const imp of imports) {
    for (const rule of HARD_VIOLATIONS) {
      if (!rule.filePattern.test(rel)) continue;

      // The last rule has its own compound pattern; test the whole import string
      const testTarget = rule.importPattern.source.includes("from ")
        ? `from "${imp}"`
        : imp;

      if (rule.importPattern.test(testTarget)) {
        console.error(`VIOLATION  ${rel}`);
        console.error(`           import: ${imp}`);
        console.error(`           rule:   ${rule.message}`);
        console.error();
        hardCount++;
      }
    }
  }
}

if (hardCount > 0) {
  console.error(`${hardCount} boundary violation(s) found. Fix before merging.`);
  process.exit(1);
} else {
  console.log("check:boundaries — no violations found.");
}
