import { describe, it, expect } from "vitest";
import { validateAmounts } from "../validators/amount-validator";
import type { ExtractedAmounts, ExtractedLineItem } from "../types";

function makeAmounts(overrides: Partial<ExtractedAmounts> = {}): ExtractedAmounts {
  return {
    net_amount_ex_vat: 1000,
    vat_amount: 70,
    total_amount: 1070,
    discount_amount: 0,
    currency: "THB",
    is_vat_included: false,
    ...overrides,
  };
}

function makeLine(overrides: Partial<ExtractedLineItem> = {}): ExtractedLineItem {
  return {
    description: "Item",
    quantity: 10,
    unit_price: 100,
    discount: 0,
    total: 1000,
    category: null,
    ...overrides,
  };
}

describe("validateAmounts", () => {
  it("returns all valid when data is correct", () => {
    const amounts = makeAmounts();
    const lines = [makeLine()];
    const result = validateAmounts(amounts, lines);

    expect(result.lineItemCheck.isValid).toBe(true);
    expect(result.lineItemCheck.failures).toHaveLength(0);
    expect(result.subtotalCheck.isValid).toBe(true);
    expect(result.vatCheck.isValid).toBe(true);
    expect(result.grandTotalCheck.isValid).toBe(true);
    expect(result.overallValid).toBe(true);
  });

  it("detects line item math error", () => {
    const amounts = makeAmounts({ net_amount_ex_vat: 500, vat_amount: 35, total_amount: 535 });
    const lines = [
      makeLine({ quantity: 5, unit_price: 100, discount: 0, total: 500 }),
      makeLine({ quantity: 3, unit_price: 50, discount: 0, total: 200 }), // should be 150
    ];
    const result = validateAmounts(amounts, lines);

    expect(result.lineItemCheck.isValid).toBe(false);
    expect(result.lineItemCheck.failures).toHaveLength(1);
    expect(result.lineItemCheck.failures[0].index).toBe(1);
    expect(result.lineItemCheck.failures[0].expected).toBe(150);
    expect(result.lineItemCheck.failures[0].got).toBe(200);
  });

  it("detects subtotal mismatch", () => {
    const lines = [makeLine({ quantity: 10, unit_price: 100, discount: 0, total: 1000 })];
    const amounts = makeAmounts({ net_amount_ex_vat: 900 }); // wrong subtotal
    const result = validateAmounts(amounts, lines);

    expect(result.subtotalCheck.isValid).toBe(false);
    expect(result.subtotalCheck.expected).toBe(1000);
    expect(result.subtotalCheck.got).toBe(900);
    expect(result.overallValid).toBe(false);
  });

  it("detects VAT mismatch", () => {
    const amounts = makeAmounts({ vat_amount: 100 }); // should be 70
    const lines = [makeLine()];
    const result = validateAmounts(amounts, lines);

    expect(result.vatCheck.isValid).toBe(false);
    expect(result.vatCheck.expected).toBeCloseTo(70);
    expect(result.vatCheck.got).toBe(100);
    expect(result.overallValid).toBe(false);
  });

  it("detects grand total mismatch", () => {
    const amounts = makeAmounts({ total_amount: 999 }); // should be 1070
    const lines = [makeLine()];
    const result = validateAmounts(amounts, lines);

    expect(result.grandTotalCheck.isValid).toBe(false);
    expect(result.grandTotalCheck.expected).toBe(1070);
    expect(result.grandTotalCheck.got).toBe(999);
    expect(result.overallValid).toBe(false);
  });

  it("handles null amounts gracefully — all pass", () => {
    const amounts = makeAmounts({
      net_amount_ex_vat: null,
      vat_amount: null,
      total_amount: null,
      discount_amount: null,
    });
    const result = validateAmounts(amounts, []);

    expect(result.lineItemCheck.isValid).toBe(true);
    expect(result.subtotalCheck.isValid).toBe(true);
    expect(result.vatCheck.isValid).toBe(true);
    expect(result.grandTotalCheck.isValid).toBe(true);
    expect(result.overallValid).toBe(true);
  });

  it("applies invoice-level discount to subtotal check", () => {
    const lines = [makeLine({ quantity: 10, unit_price: 100, discount: 0, total: 1000 })];
    // invoice discount of 100 => subtotal should be 900
    const amounts = makeAmounts({
      net_amount_ex_vat: 900,
      discount_amount: 100,
      vat_amount: 63,
      total_amount: 963,
    });
    const result = validateAmounts(amounts, lines);

    expect(result.subtotalCheck.isValid).toBe(true);
    expect(result.vatCheck.isValid).toBe(true);
    expect(result.grandTotalCheck.isValid).toBe(true);
    expect(result.overallValid).toBe(true);
  });

  it("skips subtotal check when line items have no totals", () => {
    const lines = [makeLine({ total: null })];
    const amounts = makeAmounts({ net_amount_ex_vat: 500 });
    const result = validateAmounts(amounts, lines);

    expect(result.subtotalCheck.isValid).toBe(true);
  });

  it("skips VAT check when vat_amount is zero", () => {
    const amounts = makeAmounts({ vat_amount: 0, total_amount: 1000 });
    const lines = [makeLine()];
    const result = validateAmounts(amounts, lines);

    expect(result.vatCheck.isValid).toBe(true);
  });

  it("handles multiple line items correctly", () => {
    const lines = [
      makeLine({ quantity: 5, unit_price: 100, discount: 10, total: 490 }),
      makeLine({ quantity: 2, unit_price: 200, discount: 0, total: 400 }),
    ];
    const amounts = makeAmounts({
      net_amount_ex_vat: 890,
      vat_amount: 62.3,
      total_amount: 952.3,
      discount_amount: 0,
    });
    const result = validateAmounts(amounts, lines);

    expect(result.lineItemCheck.isValid).toBe(true);
    expect(result.subtotalCheck.isValid).toBe(true);
    expect(result.vatCheck.isValid).toBe(true);
    expect(result.grandTotalCheck.isValid).toBe(true);
    expect(result.overallValid).toBe(true);
  });
});
