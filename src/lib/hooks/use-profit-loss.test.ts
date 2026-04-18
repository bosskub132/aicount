import { describe, it, expect } from "vitest";
import { profitLossKeys } from "./use-profit-loss";

describe("profitLossKeys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = profitLossKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", scope: "monthly", department: undefined, comparison: undefined }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "profit-loss",
        "11111111-1111-1111-1111-111111111111",
        {
          "comparison": undefined,
          "department": undefined,
          "period": "2026-04",
          "scope": "monthly",
        },
      ]
    `);
  });
});
