import { describe, it, expect } from "vitest";
import { taxPnd53Keys } from "./use-tax-pnd53";

describe("taxPnd53Keys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = taxPnd53Keys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04" }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "tax-pnd53",
        "11111111-1111-1111-1111-111111111111",
        {
          "period": "2026-04",
        },
      ]
    `);
  });
});
