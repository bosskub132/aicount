import { describe, it, expect } from "vitest";
import { computePaymentStatus } from "../payment-status";

const TODAY = new Date("2026-03-15");

describe("computePaymentStatus", () => {
  it('returns "paid" when paymentSum >= grandTotal', () => {
    expect(computePaymentStatus(1000, 1000, null, TODAY)).toBe("paid");
    expect(computePaymentStatus(1000, 1500, null, TODAY)).toBe("paid");
  });

  it('returns "paid" even if overdue, when fully paid', () => {
    expect(computePaymentStatus(1000, 1000, "2026-03-01", TODAY)).toBe("paid");
  });

  it('returns "overdue" when past due and not fully paid', () => {
    expect(computePaymentStatus(1000, 0, "2026-03-14", TODAY)).toBe("overdue");
    expect(computePaymentStatus(1000, 500, "2026-03-01", TODAY)).toBe("overdue");
  });

  it('returns "partial" when partially paid and not overdue', () => {
    expect(computePaymentStatus(1000, 500, "2026-03-20", TODAY)).toBe("partial");
    expect(computePaymentStatus(1000, 500, null, TODAY)).toBe("partial");
  });

  it('returns "open" when no payment and not overdue', () => {
    expect(computePaymentStatus(1000, 0, null, TODAY)).toBe("open");
    expect(computePaymentStatus(1000, 0, "2026-03-20", TODAY)).toBe("open");
  });

  it('returns "open" when due date is today (not yet overdue)', () => {
    expect(computePaymentStatus(1000, 0, "2026-03-15", TODAY)).toBe("open");
  });

  it("handles zero grandTotal as paid", () => {
    expect(computePaymentStatus(0, 0, null, TODAY)).toBe("paid");
  });
});
