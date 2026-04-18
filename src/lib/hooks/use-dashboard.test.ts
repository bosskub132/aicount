import { describe, it, expect } from "vitest";
import { dashboardKeys } from "./use-dashboard";

describe("dashboardKeys (contract)", () => {
  it("monthlyComparison key — server prefetch and client useQuery MUST agree", () => {
    const key = dashboardKeys.monthlyComparison(
      "11111111-1111-1111-1111-111111111111",
      6
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "monthly-comparison",
        "11111111-1111-1111-1111-111111111111",
        6,
      ]
    `);
  });

  it("statusBreakdown key", () => {
    const key = dashboardKeys.statusBreakdown("tenant-abc");
    expect(key).toMatchInlineSnapshot(`
      [
        "status-breakdown",
        "tenant-abc",
      ]
    `);
  });

  it("approvalQueue key", () => {
    const key = dashboardKeys.approvalQueue("tenant-abc");
    expect(key).toMatchInlineSnapshot(`
      [
        "approval-queue",
        "tenant-abc",
      ]
    `);
  });
});
