import { describe, it, expect } from "vitest";
import { bankStatementsKeys } from "./use-bank-recon-statements";

describe("bankStatementsKeys (contract)", () => {
  it("list key stable", () => {
    const key = bankStatementsKeys.list(
      "11111111-1111-1111-1111-111111111111"
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "bank-statements",
        "11111111-1111-1111-1111-111111111111",
      ]
    `);
  });
});
