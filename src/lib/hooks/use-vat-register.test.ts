import { describe, it, expect } from "vitest";
import { vatRegisterKeys } from "./use-vat-register";

describe("vatRegisterKeys (contract)", () => {
  it("purchase key stable and agrees between server and client", () => {
    const key = vatRegisterKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", direction: "EXPENSE" }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "vat-register",
        "11111111-1111-1111-1111-111111111111",
        {
          "direction": "EXPENSE",
          "period": "2026-04",
        },
      ]
    `);
  });

  it("sales key distinct from purchase", () => {
    const key = vatRegisterKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", direction: "REVENUE" }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "vat-register",
        "11111111-1111-1111-1111-111111111111",
        {
          "direction": "REVENUE",
          "period": "2026-04",
        },
      ]
    `);
  });
});
