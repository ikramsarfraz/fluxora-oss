import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { PdfRow } from "../services/extract-pdf-text";
import { findRowForLine } from "./match-line-to-pdf-row";

function row(text: string, y = 0): PdfRow {
  return {
    text,
    bbox: { page: 1, x: 0, y, width: 100, height: 12 },
  };
}

describe("findRowForLine", () => {
  it("returns the highest-overlap row when the description matches verbatim", () => {
    const rows = [
      row("QTY DESC WT RATE AMOUNT", 10),
      row("1 BRISKET SHORT RIBS 25.20 6.55 165.06", 30),
      row("2 RIB EYE STEAK 79.10 5.75 454.83", 50),
    ];
    const result = findRowForLine("BRISKET SHORT RIBS", rows);
    assert.equal(result?.bbox.y, 30);
  });

  it("tolerates extra tokens on either side", () => {
    const rows = [
      row("Delivery fee handling charge"),
      row("RR Brisket Short Rib · Brisket Short Rib"),
      row("80/20 Ground Beef Premium"),
    ];
    const result = findRowForLine("80/20 Beef", rows);
    assert.equal(result?.text, "80/20 Ground Beef Premium");
  });

  it("returns null when no row clears the minimum-overlap threshold", () => {
    const rows = [
      row("Delivery fee handling charge"),
      row("Sub total computation row"),
    ];
    const result = findRowForLine("Brisket Short Ribs", rows);
    assert.equal(result, null);
  });

  it("returns null on an empty description", () => {
    const rows = [row("BRISKET SHORT RIBS")];
    const result = findRowForLine("", rows);
    assert.equal(result, null);
  });

  it("ignores stopwords + short tokens when computing overlap", () => {
    // "the" and "and" appear in the row but shouldn't carry weight; the only
    // meaningful tokens are "delivery" + "fee".
    const rows = [
      row("THE DELIVERY AND HANDLING FEE"),
      row("FLAT RATE SHIPPING"),
    ];
    const result = findRowForLine("Delivery Fee", rows);
    assert.equal(result?.text, "THE DELIVERY AND HANDLING FEE");
  });
});
