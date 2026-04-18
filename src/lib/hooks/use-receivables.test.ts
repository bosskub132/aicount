import { describe, it, expect } from "vitest";
import { receivablesKeys } from "./use-receivables";

describe("receivablesKeys (contract)", () => {
  it("list key stable and agrees between server and client", () => {
    const key = receivablesKeys.list(
      "11111111-1111-1111-1111-111111111111",
      {
        status: undefined,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-19",
        page: 1,
        limit: 20,
        search: undefined,
      }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "receivables",
        "11111111-1111-1111-1111-111111111111",
        {
          "dateFrom": "2026-04-01",
          "dateTo": "2026-04-19",
          "limit": 20,
          "page": 1,
          "search": undefined,
          "status": undefined,
        },
      ]
    `);
  });
});
