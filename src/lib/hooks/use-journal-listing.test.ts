import { describe, it, expect } from "vitest";
import { journalListingKeys } from "./use-journal-listing";

describe("journalListingKeys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = journalListingKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", scope: "monthly", type: undefined, page: 1, limit: 50 }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "journal-listing",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 50,
          "page": 1,
          "period": "2026-04",
          "scope": "monthly",
          "type": undefined,
        },
      ]
    `);
  });
});
