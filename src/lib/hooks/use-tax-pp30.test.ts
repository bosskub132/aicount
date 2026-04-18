import { describe, it, expect } from "vitest";
import { taxPp30Keys } from "./use-tax-pp30";

describe("taxPp30Keys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = taxPp30Keys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04" }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "tax-pp30",
        "11111111-1111-1111-1111-111111111111",
        {
          "period": "2026-04",
        },
      ]
    `);
  });
});
