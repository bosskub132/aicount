import { describe, it, expect } from "vitest";
import { taxPp36Keys } from "./use-tax-pp36";

describe("taxPp36Keys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = taxPp36Keys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04" }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "tax-pp36",
        "11111111-1111-1111-1111-111111111111",
        {
          "period": "2026-04",
        },
      ]
    `);
  });
});
