import { describe, it, expect } from "vitest";
import { detectCorrections } from "../rules/rule-learner";

function makeOcrRaw() {
  return {
    issuer: {
      name: "ABC Company",
      tax_id: "1234567890123",
      branch_id: "00000",
      address: "123 Main St",
      postal_code: "10100",
    },
    customer: {
      name: "XYZ Corp",
      tax_id: "9876543210987",
      branch_id: "00001",
      address: "456 Other St",
      postal_code: "10200",
    },
    document: {
      document_type: "invoice",
      invoice_number: "INV-001",
      issue_date: "2026-01-15",
      due_date: "2026-02-15",
      credit_days: 30,
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
      overall: 0.9,
      weighted: 0.9,
      per_field: {},
    },
  };
}

describe("detectCorrections", () => {
  it("detects a changed issuerName field", () => {
    const ocrRaw = makeOcrRaw();
    const editedFields = {
      issuerName: "ABC Company Ltd.",
    };

    const corrections = detectCorrections(
      ocrRaw,
      editedFields,
      "1234567890123"
    );

    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toEqual({
      fieldName: "issuer_name",
      originalValue: "ABC Company",
      correctedValue: "ABC Company Ltd.",
      triggerKey: "issuer_tax_id",
      triggerValue: "1234567890123",
    });
  });

  it("returns empty array when no changes", () => {
    const ocrRaw = makeOcrRaw();
    const editedFields = {
      issuerName: "ABC Company",
    };

    const corrections = detectCorrections(
      ocrRaw,
      editedFields,
      "1234567890123"
    );

    expect(corrections).toHaveLength(0);
  });

  it("detects amount corrections (vatAmount changed)", () => {
    const ocrRaw = makeOcrRaw();
    const editedFields = {
      vatAmount: 100,
    };

    const corrections = detectCorrections(
      ocrRaw,
      editedFields,
      "1234567890123"
    );

    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toEqual({
      fieldName: "amounts_vat_amount",
      originalValue: "70",
      correctedValue: "100",
      triggerKey: "issuer_tax_id",
      triggerValue: "1234567890123",
    });
  });

  it("uses global trigger when no issuerTaxId", () => {
    const ocrRaw = makeOcrRaw();
    const editedFields = {
      issuerName: "New Name",
    };

    const corrections = detectCorrections(ocrRaw, editedFields, "");

    expect(corrections).toHaveLength(1);
    expect(corrections[0].triggerKey).toBe("global");
    expect(corrections[0].triggerValue).toBe("all");
  });
});
