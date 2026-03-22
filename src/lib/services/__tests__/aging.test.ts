import { describe, it, expect } from "vitest";
import { computeAgingBucket, aggregateAging } from "../aging";

const TODAY = new Date("2026-03-15");

describe("computeAgingBucket", () => {
  it('returns "current" when not yet due', () => {
    expect(computeAgingBucket("2026-03-15", TODAY)).toBe("current");
    expect(computeAgingBucket("2026-04-01", TODAY)).toBe("current");
  });

  it('returns "d30" for 1-30 days past due', () => {
    expect(computeAgingBucket("2026-03-14", TODAY)).toBe("d30"); // 1 day
    expect(computeAgingBucket("2026-02-13", TODAY)).toBe("d30"); // 30 days
  });

  it('returns "d60" for 31-60 days past due', () => {
    expect(computeAgingBucket("2026-02-12", TODAY)).toBe("d60"); // 31 days
    expect(computeAgingBucket("2026-01-14", TODAY)).toBe("d60"); // 60 days
  });

  it('returns "d90" for 61-90 days past due', () => {
    expect(computeAgingBucket("2026-01-13", TODAY)).toBe("d90"); // 61 days
    expect(computeAgingBucket("2025-12-15", TODAY)).toBe("d90"); // 90 days
  });

  it('returns "overdue" for 90+ days past due', () => {
    expect(computeAgingBucket("2025-12-14", TODAY)).toBe("overdue"); // 91 days
    expect(computeAgingBucket("2025-01-01", TODAY)).toBe("overdue");
  });
});

describe("aggregateAging", () => {
  it("sums amounts into correct buckets", () => {
    const items = [
      { dueDate: "2026-04-01", amount: 100 },   // current
      { dueDate: "2026-03-10", amount: 200 },   // d30 (5 days past)
      { dueDate: "2026-02-01", amount: 300 },   // d60 (42 days past)
      { dueDate: "2026-01-05", amount: 400 },   // d90 (69 days past)
      { dueDate: "2025-11-01", amount: 500 },   // overdue (134 days past)
    ];

    const result = aggregateAging(items, TODAY);

    expect(result.current).toBe(100);
    expect(result.d30).toBe(200);
    expect(result.d60).toBe(300);
    expect(result.d90).toBe(400);
    expect(result.overdue).toBe(500);
    expect(result.total).toBe(1500);
  });

  it("returns all zeros for empty array", () => {
    const result = aggregateAging([], TODAY);

    expect(result.current).toBe(0);
    expect(result.d30).toBe(0);
    expect(result.d60).toBe(0);
    expect(result.d90).toBe(0);
    expect(result.overdue).toBe(0);
    expect(result.total).toBe(0);
  });

  it("accumulates multiple items in the same bucket", () => {
    const items = [
      { dueDate: "2026-04-01", amount: 100 },
      { dueDate: "2026-05-01", amount: 250 },
    ];

    const result = aggregateAging(items, TODAY);
    expect(result.current).toBe(350);
    expect(result.total).toBe(350);
  });
});
