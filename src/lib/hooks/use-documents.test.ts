import { describe, it, expect } from "vitest";
import { documentKeys } from "./use-documents";

describe("documentKeys (contract)", () => {
  it("list key is stable for identical params", () => {
    const a = documentKeys.list("t1", { page: 1, limit: 20 });
    const b = documentKeys.list("t1", { page: 1, limit: 20 });
    expect(a).toEqual(b);
  });

  it("list key snapshot — server prefetch and client useQuery MUST agree", () => {
    const key = documentKeys.list(
      "11111111-1111-1111-1111-111111111111",
      { page: 1, limit: 20, status: "DRAFT", sort: "createdAt", order: "desc" }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "documents",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 20,
          "order": "desc",
          "page": 1,
          "sort": "createdAt",
          "status": "DRAFT",
        },
      ]
    `);
  });

  it("detail key snapshot", () => {
    const key = documentKeys.detail("doc-123", "tenant-abc");
    expect(key).toMatchInlineSnapshot(`
      [
        "document",
        "doc-123",
        "tenant-abc",
      ]
    `);
  });
});
