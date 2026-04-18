import { describe, it, expect } from "vitest";
import { trialBalanceKeys } from "./use-trial-balance";

describe("trialBalanceKeys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = trialBalanceKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", scope: "monthly", department: undefined }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "trial-balance",
        "11111111-1111-1111-1111-111111111111",
        {
          "department": undefined,
          "period": "2026-04",
          "scope": "monthly",
        },
      ]
    `);
  });
});
