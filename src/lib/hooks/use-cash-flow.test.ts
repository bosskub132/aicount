import { describe, it, expect } from "vitest";
import { cashFlowKeys } from "./use-cash-flow";

describe("cashFlowKeys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = cashFlowKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", scope: "monthly", comparison: undefined }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "cash-flow",
        "11111111-1111-1111-1111-111111111111",
        {
          "comparison": undefined,
          "period": "2026-04",
          "scope": "monthly",
        },
      ]
    `);
  });
});
