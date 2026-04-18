import { describe, it, expect } from "vitest";
import { balanceSheetKeys } from "./use-balance-sheet";

describe("balanceSheetKeys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = balanceSheetKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", scope: "monthly", comparison: undefined }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "balance-sheet",
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
