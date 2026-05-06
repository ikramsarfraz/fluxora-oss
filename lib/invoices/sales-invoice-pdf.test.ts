import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createSampleInvoicePdfViewModel,
  sampleInvoicePdfViewModel,
} from "./sales-invoice-pdf.sample";
import { renderInvoicePdfViewModel } from "./sales-invoice-pdf";

function countPdfPages(buffer: Buffer) {
  return buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

describe("sales invoice PDF", () => {
  it("renders the required hybrid sample invoice", async () => {
    const longMeatLine = sampleInvoicePdfViewModel.lines.find(
      line => line.id === "sample-meat-long",
    );
    const beverageLine = sampleInvoicePdfViewModel.lines.find(
      line => line.id === "sample-beverage",
    );

    assert.equal(longMeatLine?.caseWeights.length, 50);
    assert.equal(beverageLine?.totalWeight, null);
    assert.equal(sampleInvoicePdfViewModel.totals.fuelSurcharge, 10);
    assert.equal(sampleInvoicePdfViewModel.totals.taxRate, 0.07);
    assert.equal(sampleInvoicePdfViewModel.totals.taxAmount, 11.83);

    const pdf = await renderInvoicePdfViewModel(sampleInvoicePdfViewModel);
    assert.ok(pdf.byteLength > 5000);
  });

  it("renders repeated headers and footers for a multi-page invoice", async () => {
    const pdf = await renderInvoicePdfViewModel(
      createSampleInvoicePdfViewModel({ repeatLongMeatLine: 20 }),
    );

    assert.ok(pdf.byteLength > 15000);
    assert.ok(countPdfPages(pdf) > 1);
  });
});
