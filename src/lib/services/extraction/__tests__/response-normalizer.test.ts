import { describe, it, expect } from "vitest";
import { normalizeClaudeResponse } from "../parsers/response-normalizer";

describe("normalizeClaudeResponse", () => {
  it("normalizes a complete Claude response with all fields", () => {
    const raw = {
      issuer: {
        name: "บริษัท ทดสอบ จำกัด",
        tax_id: "0105556012345",
        branch_id: "00000",
        address: "123 ถนนสุขุมวิท",
        postal_code: "10110",
      },
      customer: {
        name: "บริษัท ลูกค้า จำกัด",
        tax_id: "0105556054321",
        branch_id: "00001",
        address: "456 ถนนเพชรบุรี",
        postal_code: "10400",
      },
      document: {
        document_type: "invoice",
        invoice_number: "INV-2024-001",
        issue_date: "02/08/2567",
        due_date: "02/09/2567",
        credit_days: 30,
        reference_po: "PO-2024-100",
      },
      amounts: {
        net_amount_ex_vat: "1,750,000.00",
        vat_amount: "122,500.00",
        total_amount: "1,872,500.00",
        discount_amount: "0.00",
        currency: "THB",
        is_vat_included: false,
      },
      line_items: [
        {
          description: "สินค้าทดสอบ",
          quantity: 10,
          unit_price: "175,000.00",
          discount: 0,
          total: "1,750,000.00",
          category: "goods",
        },
      ],
      confidence: {
        overall: 0.95,
        per_field: {
          issuer_name: 0.98,
          issuer_tax_id: 0.99,
          document_type: 0.95,
          invoice_number: 0.97,
          invoice_date: 0.92,
          total_amount: 0.96,
          net_amount_ex_vat: 0.94,
          vat_amount: 0.93,
        },
      },
    };

    const result = normalizeClaudeResponse(raw);

    // Issuer
    expect(result.issuer.name).toBe("บริษัท ทดสอบ จำกัด");
    expect(result.issuer.tax_id).toBe("0105556012345");

    // Customer
    expect(result.customer.name).toBe("บริษัท ลูกค้า จำกัด");

    // Document — dates should be converted from BE to CE
    expect(result.document.document_type).toBe("invoice");
    expect(result.document.issue_date).toBe("2024-08-02");
    expect(result.document.due_date).toBe("2024-09-02");
    expect(result.document.credit_days).toBe(30);

    // Amounts — numbers should be parsed
    expect(result.amounts.net_amount_ex_vat).toBe(1750000);
    expect(result.amounts.vat_amount).toBe(122500);
    expect(result.amounts.total_amount).toBe(1872500);
    expect(result.amounts.discount_amount).toBe(0);
    expect(result.amounts.currency).toBe("THB");
    expect(result.amounts.is_vat_included).toBe(false);

    // Line items
    expect(result.line_items).toHaveLength(1);
    expect(result.line_items[0].description).toBe("สินค้าทดสอบ");
    expect(result.line_items[0].quantity).toBe(10);
    expect(result.line_items[0].unit_price).toBe(175000);
    expect(result.line_items[0].total).toBe(1750000);

    // Confidence — weighted should be calculated
    expect(result.confidence.overall).toBe(0.95);
    expect(result.confidence.weighted).toBeGreaterThan(0);
    expect(result.confidence.per_field).toBeDefined();
  });

  it("handles null/missing fields with defaults", () => {
    const raw = {};

    const result = normalizeClaudeResponse(raw);

    // Issuer defaults
    expect(result.issuer.name).toBeNull();
    expect(result.issuer.tax_id).toBeNull();
    expect(result.issuer.branch_id).toBeNull();
    expect(result.issuer.address).toBeNull();
    expect(result.issuer.postal_code).toBeNull();

    // Customer defaults
    expect(result.customer.name).toBeNull();

    // Document defaults
    expect(result.document.document_type).toBeNull();
    expect(result.document.issue_date).toBeNull();

    // Amount defaults
    expect(result.amounts.net_amount_ex_vat).toBeNull();
    expect(result.amounts.currency).toBe("THB");
    expect(result.amounts.is_vat_included).toBeNull();

    // Line items default
    expect(result.line_items).toEqual([]);

    // Confidence defaults
    expect(result.confidence.overall).toBe(0);
    expect(result.confidence.weighted).toBe(0);
    expect(result.confidence.per_field).toEqual({});
  });

  it("calculates credit_due_date from issue_date + credit_days when not provided", () => {
    const raw = {
      document: {
        issue_date: "2026-01-06",
        credit_days: 30,
      },
    };

    const result = normalizeClaudeResponse(raw);

    expect(result.document.issue_date).toBe("2026-01-06");
    expect(result.document.credit_days).toBe(30);
    expect(result.document.credit_due_date).toBe("2026-02-05");
  });

  it("does not calculate credit_due_date when credit_due_date is already provided", () => {
    const raw = {
      document: {
        issue_date: "2026-01-06",
        credit_days: 30,
        credit_due_date: "15/02/2569",
      },
    };

    const result = normalizeClaudeResponse(raw);

    // The explicitly provided credit_due_date should be used (converted from BE)
    expect(result.document.credit_due_date).toBe("2026-02-15");
  });

  it("does not calculate credit_due_date when issue_date or credit_days is missing", () => {
    const raw = {
      document: {
        credit_days: 30,
      },
    };

    const result = normalizeClaudeResponse(raw);
    expect(result.document.credit_due_date).toBeNull();
  });
});
