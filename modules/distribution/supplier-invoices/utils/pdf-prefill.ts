export type SupplierInvoicePdfPaymentMethod =
  | "cash"
  | "check"
  | "ach"
  | "zelle"
  | "credit_card";

export type SupplierInvoicePdfPrefillLine = {
  productId: string;
  unitType: "catch_weight" | "fixed_case";
  weightEntryMode: "total_weight" | "default_case_weight" | "manual_case_weights";
  quantityCases: string;
  weightLbs: string;
  defaultCaseWeightLbs: string;
  caseWeightEntries: string[];
  unitPrice: string;
  lotNumberOverride: string;
  expirationDateOverride: string;
};

export type SupplierInvoicePdfPrefillValues = {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  receiveDate: string;
  paymentMethod: SupplierInvoicePdfPaymentMethod | null;
  notes: string;
  lines: SupplierInvoicePdfPrefillLine[];
};

export type SupplierInvoicePdfTotalComparison = {
  extractedTotal: string | null;
  computedLineTotal: string;
  variance: string | null;
  matches: boolean | null;
};

export type SupplierInvoicePdfPrefillResult = {
  values: SupplierInvoicePdfPrefillValues;
  warnings: string[];
  unmatchedSupplierCandidates: string[];
  unmatchedLineDescriptions: string[];
  sourceFilename: string;
  totalComparison: SupplierInvoicePdfTotalComparison;
};

export type SupplierInvoicePdfSupplierMatch = {
  id: string;
  name: string;
};

export type SupplierInvoicePdfProductMatch = {
  id: string;
  name: string;
  sku?: string | null;
};

type ParsedPdfLine = {
  description: string;
  quantityCases: number;
  weightLbs: number | null;
  unitType: "catch_weight" | "fixed_case";
  unitPrice: number;
  amount: number | null;
};

type ExtractedPdfLines = {
  lines: ParsedPdfLine[];
  skippedChargeDescriptions: string[];
};

const MONEY_RE = /\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,4})?)/;

function emptyPrefillLine(): SupplierInvoicePdfPrefillLine {
  return {
    productId: "",
    unitType: "catch_weight",
    weightEntryMode: "total_weight",
    quantityCases: "1",
    weightLbs: "0",
    defaultCaseWeightLbs: "",
    caseWeightEntries: [""],
    unitPrice: "0",
    lotNumberOverride: "",
    expirationDateOverride: "",
  };
}

function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(LLC|INC|CO|COMPANY|LTD|CORP|CORPORATION)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeText(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function parseMoney(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.match(MONEY_RE);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDecimal(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatMoneyValue(value: number | null): string | null {
  return value == null || !Number.isFinite(value) ? null : value.toFixed(2);
}

function normalizePdfLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseUsDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractInvoiceHeader(lines: string[], sourceFilename: string) {
  let invoiceNumber = "";
  let invoiceDate: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] ?? "";
    if (!invoiceDate && /^date$/i.test(line)) {
      invoiceDate = parseUsDate(nextLine);
    }
    if (!invoiceNumber && /^invoice\s*#$/i.test(line)) {
      const match = nextLine.match(/\d{3,}/);
      invoiceNumber = match?.[0] ?? "";
    }
  }

  for (const line of lines) {
    const compact = line.replace(/\s+/g, "");
    const match = compact.match(/(\d{3,}?)(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))/);
    if (!match) continue;
    invoiceNumber ||= match[1];
    invoiceDate ||= parseUsDate(match[2]);
  }

  const filenameInvoiceNumber = sourceFilename.match(/\bInv[_ -]?(\d{3,})\b/i)?.[1];
  invoiceNumber ||= filenameInvoiceNumber ?? "";

  return {
    invoiceNumber,
    invoiceDate,
  };
}

function extractDollarTotals(text: string): number[] {
  return Array.from(text.matchAll(/\$[ \t]*([0-9][0-9,]*\.[0-9]{2})/g))
    .map(match => parseMoney(match[1]))
    .filter((value): value is number => value != null);
}

function extractBalanceDue(text: string): number | null {
  const spaced = text.replace(/\s+/g, " ");
  const balanceMatch = spaced.match(/BALANCE\s+DUE\s+\$?\s*([0-9][0-9,]*\.[0-9]{2})/i);
  if (balanceMatch) return parseMoney(balanceMatch[1]);
  const totalMatch = spaced.match(/TOTAL\s+DUE\s+\$?\s*([0-9][0-9,]*\.[0-9]{2})/i);
  if (totalMatch) return parseMoney(totalMatch[1]);

  const dollarTotals = extractDollarTotals(text);
  if (dollarTotals.length === 0) return null;
  return Math.max(...dollarTotals);
}

function supplierCandidateFromFilename(sourceFilename: string): string | null {
  const withoutExtension = sourceFilename.replace(/\.[^.]+$/, "");
  const match = withoutExtension.match(/\bfrom[_ -]+(.+)$/i);
  if (!match?.[1]) return null;
  const withoutTrailingId = match[1].replace(/[_ -]+\d+$/, "");
  const candidate = withoutTrailingId.replace(/[_-]+/g, " ").trim();
  return candidate || null;
}

function extractSupplierCandidates(lines: string[], sourceFilename: string): string[] {
  const candidates: string[] = [];
  const filenameCandidate = supplierCandidateFromFilename(sourceFilename);
  if (filenameCandidate) candidates.push(filenameCandidate);

  const stopIndex = lines.findIndex(line => /^(INVOICE|BILL TO)\b/i.test(line));
  const headerLines = lines.slice(0, stopIndex >= 0 ? stopIndex : Math.min(lines.length, 8));

  for (const line of headerLines) {
    const payable = line.match(/PAYABLE\s+TO\s+(.+)$/i);
    if (payable?.[1]) candidates.push(payable[1]);

    if (/@/.test(line) || /\d{3}/.test(line) || /\b(AVE|ST|ROAD|RD|IL|IN|USA|PHONE)\b/i.test(line)) {
      continue;
    }
    if (/^[A-Z0-9 .&'/-]{3,}$/.test(line) && !/^MAKE CHECK/i.test(line)) {
      candidates.push(line);
    }
  }

  for (const line of lines) {
    if (/\bBREWER\s+LIVESTOCK\b/i.test(line)) {
      candidates.push("BREWER LIVESTOCK");
    }
    if (/\bZABIHA\s+HALAL\s+MEAT\s+PROCESSORS\b/i.test(line)) {
      candidates.push("Zabiha Halal Meat Processors");
    }
    if (/\bFATIMA\s*BRAND\b/i.test(line)) {
      candidates.push("Fatima Brand");
    }
  }

  return uniqueStrings(candidates);
}

function isNonInventoryCharge(description: string): boolean {
  return /\b(FEE|CHARGE|DELIVERY|FREIGHT|SHIPPING|SERVICE|TAX)\b/i.test(description);
}

function isStopAfterPackedTable(line: string): boolean {
  return /^(CLAIMS|CUSTOMER'?S SIGNATURE|DRIVER'?S SIGNATURE|PAYMENTS|THANK YOU|SIGNATURE|THIS SLIP|\*NO CLAIMS)/i.test(line);
}

function parseQuantityFromEnd(value: string): {
  description: string;
  quantityCases: number;
} | null {
  const withUnit = value.match(/^(.*?)(\d+)\s*(?:cs|c|case|cases|pc|pcs|box|boxes)$/i);
  if (withUnit) {
    const quantityCases = Number(withUnit[2]);
    const description = withUnit[1].trim();
    if (Number.isInteger(quantityCases) && quantityCases > 0 && description) {
      return { description, quantityCases };
    }
  }

  const candidates: Array<{
    description: string;
    quantityCases: number;
    score: number;
  }> = [];
  for (let i = 0; i < value.length; i++) {
    const quantityText = value.slice(i).trim();
    if (!/^\d+$/.test(quantityText)) continue;
    const quantityCases = Number(quantityText);
    const description = value.slice(0, i).trim();
    if (!Number.isInteger(quantityCases) || quantityCases <= 0 || !description) {
      continue;
    }
    if (/[.\-/]$/.test(description)) continue;
    candidates.push({
      description,
      quantityCases,
      score:
        (/\d$/.test(description) ? -10 : 10) +
        quantityText.length +
        (quantityCases <= 20 ? 5 : 0),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]
    ? {
        description: candidates[0].description,
        quantityCases: candidates[0].quantityCases,
      }
    : null;
}

function numericSuffixCandidates(value: string) {
  const candidates: Array<{ prefix: string; value: number; text: string }> = [];
  for (let i = 0; i < value.length; i++) {
    const text = value.slice(i).trim();
    if (!/^\d+(?:\.\d{1,4})?$/.test(text)) continue;
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    candidates.push({
      prefix: value.slice(0, i).trim(),
      value: parsed,
      text,
    });
  }
  return candidates;
}

function parsePackedWeightedRow(line: string): ParsedPdfLine | null {
  const compact = line.trim();
  if (!compact) return null;
  const parsedCandidates: Array<{ line: ParsedPdfLine; score: number }> = [];

  for (let amountStart = 0; amountStart < compact.length; amountStart++) {
    const amountText = compact.slice(amountStart).trim();
    if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}$/.test(amountText)) continue;
    const amount = parseMoney(amountText);
    if (amount == null) continue;
    const beforeAmount = compact.slice(0, amountStart).trim();
    // 0.5% of amount, minimum $0.02 — handles catch-weight rounding on large lines
    const tolerance = Math.max(0.02, amount * 0.005);

    for (const rateCandidate of numericSuffixCandidates(beforeAmount)) {
      const rate = rateCandidate.value;
      if (rate <= 0 || rate > 1000) continue;
      const beforeRate = rateCandidate.prefix;

      for (const weightCandidate of numericSuffixCandidates(beforeRate)) {
        const quantity = parseQuantityFromEnd(weightCandidate.prefix);
        if (!quantity) continue;
        const catchDelta = Math.abs(weightCandidate.value * rate - amount);
        const fixedDelta = Math.abs(quantity.quantityCases * rate - amount);
        if (catchDelta <= tolerance && fixedDelta <= tolerance) {
          parsedCandidates.push({
            line: {
              description: quantity.description,
              quantityCases: quantity.quantityCases,
              weightLbs: null,
              unitType: "fixed_case",
              unitPrice: rate,
              amount,
            },
            score: 120,
          });
        } else if (catchDelta <= tolerance) {
          parsedCandidates.push({
            line: {
              description: quantity.description,
              quantityCases: quantity.quantityCases,
              weightLbs: weightCandidate.value,
              unitType: "catch_weight",
              unitPrice: rate,
              amount,
            },
            score: 110,
          });
        } else if (fixedDelta <= tolerance) {
          parsedCandidates.push({
            line: {
              description: quantity.description,
              quantityCases: quantity.quantityCases,
              weightLbs: null,
              unitType: "fixed_case",
              unitPrice: rate,
              amount,
            },
            score: 90,
          });
        }
      }

      const fixedQuantity = parseQuantityFromEnd(beforeRate);
      if (fixedQuantity && Math.abs(fixedQuantity.quantityCases * rate - amount) <= tolerance) {
        parsedCandidates.push({
          line: {
            description: fixedQuantity.description,
            quantityCases: fixedQuantity.quantityCases,
            weightLbs: null,
            unitType: "fixed_case",
            unitPrice: rate,
            amount,
          },
          score: 80,
        });
      }
    }
  }

  parsedCandidates.sort((a, b) => b.score - a.score);
  return parsedCandidates[0]?.line ?? null;
}

function extractBoxInvoiceLines(lines: string[]): ParsedPdfLine[] {
  const parsedLines: ParsedPdfLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const header = lines[i];
    const boxMatch = header.match(/^(.+?)(\d+)\s*BOX\b/i);
    if (!boxMatch) continue;

    const description = boxMatch[1].trim();
    const quantityCases = Number(boxMatch[2]);
    if (!description || !Number.isFinite(quantityCases) || quantityCases <= 0) {
      continue;
    }

    const weightLineIndex = lines
      .slice(i + 1, i + 4)
      .findIndex(line => /\bLBS?\b/i.test(line));
    const absoluteWeightIndex = weightLineIndex >= 0 ? i + 1 + weightLineIndex : -1;
    const weightLbs =
      absoluteWeightIndex >= 0 ? parseMoney(lines[absoluteWeightIndex]) : null;
    const packedLine = absoluteWeightIndex >= 0
      ? lines[absoluteWeightIndex + 1]
      : lines[i + 1];
    const { unitPrice, amount } = parseRateAndAmount(packedLine, weightLbs);

    if (!unitPrice || unitPrice <= 0) {
      continue;
    }

    parsedLines.push({
      description,
      quantityCases,
      weightLbs,
      unitType: weightLbs != null ? "catch_weight" : "fixed_case",
      unitPrice,
      amount,
    });
  }

  return parsedLines;
}

// Column keyword groups for generic header detection (need 3+ groups to match)
const TABLE_HEADER_COLUMN_PATTERNS: RegExp[] = [
  /\b(DESCRIPTION|ITEM|PRODUCT|DETAIL)\b/i,
  /\b(QTY|QUANTITY|CASES?|NO\.?|COUNT|PCS|BOXES?)\b/i,
  /\b(WEIGHT|LBS?|WT)\b/i,
  /\b(RATE|PRICE|UNIT[\s-]?PRICE|PER[\s]?LB|COST)\b/i,
  /\b(AMOUNT|TOTAL|SUBTOTAL|EXTENDED)\b/i,
];

function detectTableHeaderLine(lines: string[]): number {
  // Strategy 1: exact known compact formats (fastest path)
  const exactIndex = lines.findIndex(line =>
    /(?:DESCRIPTIONQUANTITYWEIGHTPRICEAMOUNT|ITEMDESCRIPTIONQTYQTY\/WEIGHTRATEAMOUNT)/i.test(
      line.replace(/\s+/g, ""),
    ),
  );
  if (exactIndex >= 0) return exactIndex;

  // Strategy 2: generic — any line matching 3+ column keyword groups
  return lines.findIndex(line => {
    // Skip lines that contain monetary amounts — those are data rows, not headers
    if (/\d+\.\d{2}/.test(line)) return false;
    return TABLE_HEADER_COLUMN_PATTERNS.filter(p => p.test(line)).length >= 3;
  });
}

function tryParseWithJoin(
  lines: string[],
  i: number,
): { parsed: ParsedPdfLine; consumed: number } | null {
  const parsed = parsePackedWeightedRow(lines[i]);
  if (parsed) return { parsed, consumed: 1 };

  // Two-line joining: description on one line, numbers on the next
  if (i + 1 < lines.length && !isStopAfterPackedTable(lines[i + 1])) {
    const joined = lines[i] + " " + lines[i + 1];
    const joinedParsed = parsePackedWeightedRow(joined);
    if (joinedParsed) return { parsed: joinedParsed, consumed: 2 };
  }

  return null;
}

function extractPackedInvoiceLines(lines: string[]): ExtractedPdfLines {
  const parsedLines: ParsedPdfLine[] = [];
  const skippedChargeDescriptions: string[] = [];
  const tableStart = detectTableHeaderLine(lines);
  if (tableStart < 0) return { lines: parsedLines, skippedChargeDescriptions };

  const tableLines = lines.slice(tableStart + 1);
  for (let i = 0; i < tableLines.length; i++) {
    if (isStopAfterPackedTable(tableLines[i])) break;
    const result = tryParseWithJoin(tableLines, i);
    if (!result) continue;
    i += result.consumed - 1;
    if (isNonInventoryCharge(result.parsed.description)) {
      skippedChargeDescriptions.push(result.parsed.description);
      continue;
    }
    parsedLines.push(result.parsed);
  }

  return {
    lines: parsedLines,
    skippedChargeDescriptions: uniqueStrings(skippedChargeDescriptions),
  };
}

// Generic fallback — scans all lines without requiring a header row.
// Used when neither box format nor any recognizable table header is found.
function extractGenericNumericLines(lines: string[]): ExtractedPdfLines {
  const parsedLines: ParsedPdfLine[] = [];
  const skippedChargeDescriptions: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isStopAfterPackedTable(lines[i])) break;
    const result = tryParseWithJoin(lines, i);
    if (!result) continue;
    i += result.consumed - 1;
    if (isNonInventoryCharge(result.parsed.description)) {
      skippedChargeDescriptions.push(result.parsed.description);
      continue;
    }
    parsedLines.push(result.parsed);
  }

  return {
    lines: parsedLines,
    skippedChargeDescriptions: uniqueStrings(skippedChargeDescriptions),
  };
}

function extractInvoiceLines(lines: string[]): ExtractedPdfLines {
  const boxLines = extractBoxInvoiceLines(lines);
  if (boxLines.length > 0) {
    return { lines: boxLines, skippedChargeDescriptions: [] };
  }
  const packedResult = extractPackedInvoiceLines(lines);
  if (packedResult.lines.length > 0) return packedResult;
  // Generic fallback: no header required — pure numeric pattern matching
  return extractGenericNumericLines(lines);
}

function parseRateAndAmount(
  packedLine: string | undefined,
  knownWeight: number | null,
): { unitPrice: number | null; amount: number | null } {
  if (!packedLine) return { unitPrice: null, amount: null };
  const spacedParts = packedLine
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean);
  if (spacedParts.length >= 3) {
    return {
      unitPrice: parseMoney(spacedParts[spacedParts.length - 2]),
      amount: parseMoney(spacedParts[spacedParts.length - 1]),
    };
  }

  if (knownWeight != null) {
    const compact = packedLine.replace(/\s+/g, "").replace(/\$/g, "");
    const weightCandidates = uniqueStrings([
      String(Math.round(knownWeight)),
      knownWeight.toFixed(2),
      knownWeight.toFixed(4),
    ]).map(value => value.replace(/\.0+$/, ""));

    for (let i = 0; i < compact.length; i++) {
      const amountText = compact.slice(i);
      if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}$/.test(amountText)) {
        continue;
      }
      const prefix = compact.slice(0, i).replace(/,/g, "");
      for (const candidate of weightCandidates) {
        if (!prefix.startsWith(candidate)) continue;
        const rateText = prefix.slice(candidate.length);
        if (!/^\d+\.\d{1,4}$/.test(rateText)) continue;
        const rate = Number(rateText);
        const amount = parseMoney(amountText);
        if (
          Number.isFinite(rate) &&
          rate > 0 &&
          amount != null &&
          Math.abs(knownWeight * rate - amount) <= 0.01
        ) {
          return { unitPrice: rate, amount };
        }
      }
    }
  }

  const compact = packedLine.replace(/\s+/g, "").replace(/\$/g, "");
  const amountMatch = compact.match(/((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})$/);
  if (!amountMatch) return { unitPrice: null, amount: null };

  const amount = parseMoney(amountMatch[1]);
  const prefix = compact.slice(0, compact.length - amountMatch[1].length).replace(/,/g, "");
  const fallback = prefix.match(/^(\d+)(\d+\.\d{2,4})$/);
  return {
    unitPrice: fallback ? Number(fallback[2]) : null,
    amount,
  };
}

function scoreTextMatch(candidate: string, target: string): number {
  const left = normalizeText(candidate);
  const right = normalizeText(target);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 85;

  const leftTokens = new Set(left.split(" "));
  const rightTokens = right.split(" ");
  const shared = rightTokens.filter(token => leftTokens.has(token)).length;
  if (rightTokens.length > 0 && shared === rightTokens.length) return 75;
  return 0;
}

function chooseUniqueBest<T>(
  candidates: T[],
  score: (candidate: T) => number,
): T | null {
  const scored = candidates
    .map(candidate => ({ candidate, score: score(candidate) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].candidate;
}

function matchSupplierId(
  supplierCandidates: string[],
  suppliers: SupplierInvoicePdfSupplierMatch[],
): string {
  const matches = supplierCandidates
    .map(candidate =>
      chooseUniqueBest(suppliers, supplier =>
        scoreTextMatch(candidate, supplier.name),
      ),
    )
    .filter((supplier): supplier is SupplierInvoicePdfSupplierMatch => Boolean(supplier));
  const unique = new Map(matches.map(supplier => [supplier.id, supplier]));
  return unique.size === 1 ? Array.from(unique.keys())[0] : "";
}

function matchProductId(
  description: string,
  products: SupplierInvoicePdfProductMatch[],
): string {
  const match = chooseUniqueBest(products, product =>
    Math.max(
      scoreTextMatch(description, product.name),
      product.sku ? scoreTextMatch(description, product.sku) : 0,
    ),
  );
  return match?.id ?? "";
}

function parsePaymentMethod(text: string): SupplierInvoicePdfPaymentMethod | null {
  const normalized = text.replace(/\s+/g, " ");
  const explicitPrefix = /(?:PAYMENT\s+METHOD|PAID\s+BY|PAID\s+VIA)\s*:?\s*/i;
  if (!explicitPrefix.test(normalized)) return null;
  if (new RegExp(`${explicitPrefix.source}ZELLE`, "i").test(normalized)) return "zelle";
  if (new RegExp(`${explicitPrefix.source}ACH`, "i").test(normalized)) return "ach";
  if (new RegExp(`${explicitPrefix.source}CASH`, "i").test(normalized)) return "cash";
  if (new RegExp(`${explicitPrefix.source}CHECK`, "i").test(normalized)) return "check";
  if (new RegExp(`${explicitPrefix.source}(CREDIT CARD|CARD)`, "i").test(normalized)) {
    return "credit_card";
  }
  return null;
}

export function parseSupplierInvoicePdfText(args: {
  text: string;
  sourceFilename: string;
  suppliers: SupplierInvoicePdfSupplierMatch[];
  products: SupplierInvoicePdfProductMatch[];
}): SupplierInvoicePdfPrefillResult {
  const lines = normalizePdfLines(args.text);
  const supplierCandidates = extractSupplierCandidates(lines, args.sourceFilename);
  const header = extractInvoiceHeader(lines, args.sourceFilename);
  const invoiceDate = header.invoiceDate ?? new Date().toISOString().slice(0, 10);
  const extractedInvoiceLines = extractInvoiceLines(lines);
  const parsedInvoiceLines = extractedInvoiceLines.lines;
  const supplierId = matchSupplierId(supplierCandidates, args.suppliers);
  const unmatchedSupplierCandidates = supplierId ? [] : supplierCandidates;
  const unmatchedLineDescriptions: string[] = [];
  const warnings: string[] = [];

  const prefillLines = parsedInvoiceLines.map(line => {
    const productId = matchProductId(line.description, args.products);
    if (!productId) unmatchedLineDescriptions.push(line.description);
    return {
      ...emptyPrefillLine(),
      productId,
      unitType: line.unitType,
      quantityCases: String(line.quantityCases),
      weightLbs: line.weightLbs != null ? formatDecimal(line.weightLbs, 4) : "0",
      unitPrice: formatDecimal(line.unitPrice, 4),
      caseWeightEntries: Array.from({ length: line.quantityCases }, () => ""),
    };
  });

  if (!supplierId) {
    warnings.push("Supplier was not matched. Choose a supplier before saving.");
  }
  if (!header.invoiceNumber) {
    warnings.push("Invoice number was not found. Enter it before saving.");
  }
  if (!header.invoiceDate) {
    warnings.push("Invoice date was not found. Today was used as a placeholder.");
  } else {
    warnings.push("Receive date defaulted to the invoice date. Adjust it if the shipment arrived later.");
  }
  if (unmatchedLineDescriptions.length > 0) {
    warnings.push("Some product lines were not matched. Choose products before saving.");
  }
  if (prefillLines.length === 0) {
    warnings.push("No invoice line items could be read from this PDF.");
  }
  if (extractedInvoiceLines.skippedChargeDescriptions.length > 0) {
    warnings.push(
      `Non-inventory charges were not imported: ${extractedInvoiceLines.skippedChargeDescriptions.join(", ")}.`,
    );
  }

  const extractedTotal = extractBalanceDue(args.text);
  const computedLineTotal = parsedInvoiceLines.reduce(
    (sum, line) => sum + (line.amount ?? ((line.weightLbs ?? line.quantityCases) * line.unitPrice)),
    0,
  );
  const variance =
    extractedTotal == null ? null : Number((computedLineTotal - extractedTotal).toFixed(2));
  const totalMatches =
    extractedTotal == null ? null : Math.abs((variance ?? 0)) <= 0.01;

  if (totalMatches === false) {
    warnings.push("Parsed line totals do not match the PDF balance due. Review amounts before saving.");
  }

  return {
    values: {
      supplierId,
      invoiceNumber: header.invoiceNumber,
      invoiceDate,
      receiveDate: invoiceDate,
      paymentMethod: parsePaymentMethod(args.text),
      notes: "",
      lines: prefillLines.length > 0 ? prefillLines : [emptyPrefillLine()],
    },
    warnings: uniqueStrings(warnings),
    unmatchedSupplierCandidates,
    unmatchedLineDescriptions: uniqueStrings(unmatchedLineDescriptions),
    sourceFilename: args.sourceFilename,
    totalComparison: {
      extractedTotal: formatMoneyValue(extractedTotal),
      computedLineTotal: formatMoneyValue(computedLineTotal) ?? "0.00",
      variance: formatMoneyValue(variance),
      matches: totalMatches,
    },
  };
}
