import { describe, it, expect } from "vitest";
import { validateFields } from "../validators/field-validator";

describe("validateFields", () => {
  it("validates a correct tax ID (13 digits)", () => {
    const result = validateFields({ tax_id: "1234567890123" });
    expect(result.tax_id.isValid).toBe(true);
  });

  it("rejects tax ID with wrong length", () => {
    const result = validateFields({ tax_id: "12345" });
    expect(result.tax_id.isValid).toBe(false);
    expect(result.tax_id.reason).toBeDefined();
  });

  it("rejects tax ID with non-digit characters", () => {
    const result = validateFields({ tax_id: "123456789012A" });
    expect(result.tax_id.isValid).toBe(false);
    expect(result.tax_id.reason).toBeDefined();
  });

  it("validates correct dates", () => {
    const result = validateFields({
      issue_date: "2025-01-15",
      due_date: "2025-02-15",
      credit_due_date: "2025-03-15",
    });
    expect(result.issue_date.isValid).toBe(true);
    expect(result.due_date.isValid).toBe(true);
    expect(result.credit_due_date.isValid).toBe(true);
  });

  it("rejects date with year out of range", () => {
    const result = validateFields({ issue_date: "1999-01-15" });
    expect(result.issue_date.isValid).toBe(false);
    expect(result.issue_date.reason).toBeDefined();
  });

  it("rejects date with year above range", () => {
    const result = validateFields({ issue_date: "2031-01-15" });
    expect(result.issue_date.isValid).toBe(false);
  });

  it("validates correct currency codes", () => {
    const result = validateFields({ currency: "THB" });
    expect(result.currency.isValid).toBe(true);
  });

  it("rejects invalid currency codes", () => {
    const result = validateFields({ currency: "XYZ" });
    expect(result.currency.isValid).toBe(false);
    expect(result.currency.reason).toBeDefined();
  });

  it("validates non-negative amounts", () => {
    const result = validateFields({
      amount: 100,
      vat_amount: 7,
      total_amount: 107,
      net_amount_ex_vat: 100,
      discount_amount: 0,
    });
    expect(result.amount.isValid).toBe(true);
    expect(result.vat_amount.isValid).toBe(true);
    expect(result.total_amount.isValid).toBe(true);
    expect(result.net_amount_ex_vat.isValid).toBe(true);
    expect(result.discount_amount.isValid).toBe(true);
  });

  it("rejects negative amounts", () => {
    const result = validateFields({ amount: -5 });
    expect(result.amount.isValid).toBe(false);
    expect(result.amount.reason).toBeDefined();
  });

  it("rejects non-finite amounts", () => {
    const result = validateFields({ total_amount: Infinity });
    expect(result.total_amount.isValid).toBe(false);
  });

  it("treats null values as valid", () => {
    const result = validateFields({ tax_id: null, issue_date: null, amount: null });
    expect(result.tax_id.isValid).toBe(true);
    expect(result.issue_date.isValid).toBe(true);
    expect(result.amount.isValid).toBe(true);
  });

  it("treats unknown keys as valid", () => {
    const result = validateFields({ some_random_field: "hello" });
    expect(result.some_random_field.isValid).toBe(true);
  });

  it("handles Thai Buddhist Era dates (year > 2500)", () => {
    // Buddhist year 2568 = 2025 CE — validator should accept after converting
    // But the spec says "year between 2000-2030", so raw 2568 would fail
    const result = validateFields({ issue_date: "2568-01-15" });
    expect(result.issue_date.isValid).toBe(false);
  });
});
