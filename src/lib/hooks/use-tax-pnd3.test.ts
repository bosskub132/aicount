import { describe, it, expect } from "vitest";
import { taxPnd3Keys } from "./use-tax-pnd3";

describe("taxPnd3Keys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = taxPnd3Keys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04" }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "tax-pnd3",
        "11111111-1111-1111-1111-111111111111",
        {
          "period": "2026-04",
        },
      ]
    `);
  });
});
