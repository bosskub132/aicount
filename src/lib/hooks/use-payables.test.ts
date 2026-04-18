import { describe, it, expect } from "vitest";
import { payablesKeys } from "./use-payables";

describe("payablesKeys (contract)", () => {
  it("list key stable and agrees between server and client", () => {
    const key = payablesKeys.list(
      "11111111-1111-1111-1111-111111111111",
      { status: "", search: "", page: 1, limit: 20 }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "payables",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 20,
          "page": 1,
          "search": "",
          "status": "",
        },
      ]
    `);
  });
});
