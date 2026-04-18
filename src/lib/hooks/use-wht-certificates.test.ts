import { describe, it, expect } from "vitest";
import { whtCertificatesKeys } from "./use-wht-certificates";

describe("whtCertificatesKeys (contract)", () => {
  it("list key stable and agrees between server and client", () => {
    const key = whtCertificatesKeys.list(
      "11111111-1111-1111-1111-111111111111",
      { period: "2026-04", search: undefined, status: undefined, page: 1, limit: 50 }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "wht-certificates",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 50,
          "page": 1,
          "period": "2026-04",
          "search": undefined,
          "status": undefined,
        },
      ]
    `);
  });

  it("stats key", () => {
    const key = whtCertificatesKeys.stats(
      "11111111-1111-1111-1111-111111111111",
      "2026-04"
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "wht-certificates",
        "stats",
        "11111111-1111-1111-1111-111111111111",
        "2026-04",
      ]
    `);
  });
});
