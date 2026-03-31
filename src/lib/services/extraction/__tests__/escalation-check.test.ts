import { describe, it, expect } from "vitest";
import { shouldEscalate } from "../validators/escalation-check";
import type { ExtractedData, ValidationResult } from "../types";

function makeValidation(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    lineItemCheck: { isValid: true, failures: [] },
    subtotalCheck: { isValid: true, expected: 1000, got: 1000 },
    vatCheck: { isValid: true, expected: 70, got: 70 },
    grandTotalCheck: { isValid: true, expected: 1070, got: 1070 },
    overallValid: true,
    ...overrides,
  };
}

function makeData(overrides: {
  weighted?: number;
  overall?: number;
  per_field?: Record<string, number>;
} = {}): ExtractedData {
  return {
    issuer: { name: "Test", tax_id: "1234567890123", branch_id: null, address: null, postal_code: null },
    customer: { name: "Cust", tax_id: "9876543210123", branch_id: null, address: null, postal_code: null },
    document: {
      document_type: "invoice",
      invoice_number: "INV-001",
      issue_date: "2025-01-15",
      due_date: null,
      credit_days: null,
      credit_due_date: null,
      reference_po: null,
    },
    amounts: {
      net_amount_ex_vat: 1000,
      vat_amount: 70,
      total_amount: 1070,
      discount_amount: 0,
      currency: "THB",
      is_vat_included: false,
    },
    line_items: [],
    confidence: {
      overall: overrides.overall ?? 0.9,
      weighted: overrides.weighted ?? 0.85,
      per_field: overrides.per_field ?? {
        issuer_tax_id: 0.95,
        total_amount: 0.9,
        vat_amount: 0.88,
        invoice_number: 0.92,
        issue_date: 0.91,
      },
    },
  };
}

describe("shouldEscalate", () => {
  it("returns false for high confidence and passing validation", () => {
    const result = shouldEscalate(makeData(), makeValidation());
    expect(result).toBe(false);
  });

  it("returns true for low weighted confidence", () => {
    const result = shouldEscalate(makeData({ weighted: 0.5 }), makeValidation());
    expect(result).toBe(true);
  });

  it("returns true for low critical field confidence", () => {
    const data = makeData({ per_field: {
      issuer_tax_id: 0.95,
      total_amount: 0.9,
      vat_amount: 0.88,
      invoice_number: 0.3, // below 0.50
      issue_date: 0.91,
    }});
    const result = shouldEscalate(data, makeValidation());
    expect(result).toBe(true);
  });

  it("returns true for failed amount validation (line item)", () => {
    const validation = makeValidation({
      lineItemCheck: { isValid: false, failures: [{ index: 0, expected: 100, got: 200 }] },
      overallValid: false,
    });
    const result = shouldEscalate(makeData(), validation);
    expect(result).toBe(true);
  });

  it("returns true for failed subtotal check", () => {
    const validation = makeValidation({
      subtotalCheck: { isValid: false, expected: 1000, got: 900 },
      overallValid: false,
    });
    const result = shouldEscalate(makeData(), validation);
    expect(result).toBe(true);
  });

  it("returns true for failed vat check", () => {
    const validation = makeValidation({
      vatCheck: { isValid: false, expected: 70, got: 100 },
      overallValid: false,
    });
    const result = shouldEscalate(makeData(), validation);
    expect(result).toBe(true);
  });

  it("returns true for failed grand total check", () => {
    const validation = makeValidation({
      grandTotalCheck: { isValid: false, expected: 1070, got: 999 },
      overallValid: false,
    });
    const result = shouldEscalate(makeData(), validation);
    expect(result).toBe(true);
  });

  it("returns reasons array with withReasons=true", () => {
    const data = makeData({ weighted: 0.5, per_field: {
      issuer_tax_id: 0.95,
      total_amount: 0.9,
      vat_amount: 0.88,
      invoice_number: 0.3,
      issue_date: 0.91,
    }});
    const validation = makeValidation({
      lineItemCheck: { isValid: false, failures: [{ index: 0, expected: 100, got: 200 }] },
      overallValid: false,
    });

    const result = shouldEscalate(data, validation, true);
    expect(result.escalate).toBe(true);
    expect(result.reasons).toContain("weighted_confidence_0.5");
    expect(result.reasons).toContain("low_field:invoice_number=0.3");
    expect(result.reasons).toContain("line_item_check_failed");
  });

  it("returns empty reasons when no escalation needed", () => {
    const result = shouldEscalate(makeData(), makeValidation(), true);
    expect(result.escalate).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("includes all four validation failure reasons", () => {
    const validation = makeValidation({
      lineItemCheck: { isValid: false, failures: [{ index: 0, expected: 100, got: 200 }] },
      subtotalCheck: { isValid: false, expected: 1000, got: 900 },
      vatCheck: { isValid: false, expected: 70, got: 100 },
      grandTotalCheck: { isValid: false, expected: 1070, got: 999 },
      overallValid: false,
    });
    const result = shouldEscalate(makeData(), validation, true);
    expect(result.reasons).toContain("line_item_check_failed");
    expect(result.reasons).toContain("subtotal_check_failed");
    expect(result.reasons).toContain("vat_check_failed");
    expect(result.reasons).toContain("grand_total_check_failed");
  });
});
