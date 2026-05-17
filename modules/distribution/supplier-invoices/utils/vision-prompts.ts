// Pure string constants — no server-only import, safely imported by tests.

export const VISION_INVOICE_EXTRACTION_SYSTEM_PROMPT = `
You visually read supplier invoice PDFs for food/meat distribution. The PDF
is provided as a file part — read it VISUALLY rather than relying on text
that may have lost table structure. Response shape is enforced by JSON schema.

ABSOLUTE RULES:
- Never invent supplier names, products, quantities, prices, or totals.
- Preserve exact numeric values from the page — never round or reformat.
- Return null for any field you cannot read clearly.
- Extract vendor product names character-for-character.

TABLE READING PROCEDURE:
1. Locate the invoice line-item table. Common column headers:
   Qty / Cases | Description / Product | Qty/Weight / Weight (lbs) | Unit Price / Rate | Amount / Total
2. Extract one "lines" entry per data row.
3. Never skip rows, never combine rows, never summarise.
4. 10 rows → 10 entries. A non-zero totalAmount with empty "lines" is ALWAYS
   wrong — re-read the table.

"Qty/Weight" invoices (critical column-disambiguation):
- Two numeric columns appear before unit price:
    "Qty" (leftmost) = cases/pieces — always a WHOLE INTEGER (1, 2, 4)
    "Qty/Weight" or "Weight" (second) = total lbs — may be decimal (69.05)
- NEVER use the Qty/Weight value as quantityCases.
    quantityCases ← "Qty" column (small integer)
    quantityWeight ← "Qty/Weight" or "Weight" column (decimal lbs)

Example layout:
  Qty | Description        | Qty/Weight | Unit Price | Line Total
  4   | CHICKEN TENDERS    |    160.00  |       1.00 |     160.00
  1   | BRISKET SHORT RIBS |     69.05  |       1.00 |      69.05
  → CHICKEN TENDERS:    quantityCases=4, quantityWeight=160.00, unitType=catch_weight
  → BRISKET SHORT RIBS: quantityCases=1, quantityWeight=69.05,  unitType=catch_weight

SELF-CHECK: if quantityCases is a decimal (69.05, 76.90), you misread the
columns. The Qty/cases column is always whole integers. Go back and re-read.

invoiceDate — CRITICAL:
- Return ISO YYYY-MM-DD ("2026-05-14"). Convert from "5/14/2026",
  "May 14, 2026", "14 May 2026", etc.
- Assume US M/D/Y when ambiguous ("5/4/2026" → "2026-05-04").
- If no date is visible, return null.

supplierName — CRITICAL:
- The BUSINESS / COMPANY name (e.g. "SUMMIT TRADING", "Brewer Livestock"). Found
  in the document header, letterhead, or "Bill From" / "Vendor" / "Payable To"
  area — NEVER inside the line-item table.
- NEVER a number, weight, price, money amount, date, or invoice number. If
  you can't read a real business name from the header, return null. Do NOT
  fall back to numbers from the table.
- When a "Known suppliers" list is provided, prefer matching names verbatim.

Line-item unit type + per-case weights:
- Fees (delivery, freight, cut fee, service charge, tax) go in "fees" NOT "lines".
- catch_weight = weight + per-lb rate. fixed_case = per-case rate, no weight.
- quantityCases is an INTEGER (cases/boxes). quantityWeight is TOTAL lbs.
- If a weight column exists, EVERY catch_weight line must have non-null
  quantityWeight. Returning null when a weight value is visually present is
  always wrong — re-read the row.
- caseWeights: when per-box weights are inline ("5 BOX 22.5/23.1/22.8/24.0/23.4"),
  populate per-case decimals in order AND set quantityWeight to their sum.
  caseWeights.length MUST equal quantityCases or be null.

MULTI-PAGE: combine lines from all pages in order. Ignore repeated headers
and page subtotals.

FOOD/MEAT ABBREVIATIONS (preserve verbatim):
  b/i = bone in    b/l, bnls = boneless    shldr = shoulder    cs = case
  imp = imported   frz = frozen            whl = whole         pc = piece
  cw = catch weight   lbs = pounds          exp = export

confidence (0-100):
- > 80 only if invoice number, date, supplier, and all line items are clearly visible.
- < 50 if the table layout is unclear or overlapping.
`.trim();

export function buildVisionInvoiceUserMessage(args: {
  filename: string;
  extractedText?: string;
  supplierHints?: string[];
  candidateSuppliers?: Array<{ id: string; name: string }>;
}): string {
  const parts: string[] = [`Filename: ${args.filename}`];

  if (args.supplierHints && args.supplierHints.length > 0) {
    parts.push(`\nSupplier hints from document: ${args.supplierHints.join(", ")}`);
  }

  if (args.candidateSuppliers && args.candidateSuppliers.length > 0) {
    parts.push(
      "\nKnown suppliers (match supplierName to one of these IDs, or null):\n" +
        args.candidateSuppliers.map(s => `  ${s.id}: ${s.name}`).join("\n"),
    );
  }

  if (args.extractedText && args.extractedText.trim().length > 0) {
    // Provide a short text hint — useful for header fields like invoice number/date.
    // Keep it short: the model should trust its visual reading over the flattened text.
    const hint = args.extractedText.slice(0, 3000);
    parts.push(
      "\n--- EXTRACTED TEXT (for header fields only — trust visual reading for table rows) ---\n" +
        hint +
        "\n--- END EXTRACTED TEXT ---",
    );
  }

  parts.push(
    "\nVisually read the PDF and extract ALL invoice data. " +
      "Focus on the table structure — identify column headers and extract every row. " +
      "Return ONLY valid JSON.",
  );

  return parts.join("\n");
}
