import { describe, it, expect } from "vitest";
import { journalEntriesKeys } from "./use-journal-entries";

describe("journalEntriesKeys (contract)", () => {
  it("list key stable and agrees between server and client", () => {
    const key = journalEntriesKeys.list(
      "11111111-1111-1111-1111-111111111111",
      { page: 1, limit: 20 }
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "journal-entries",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 20,
          "page": 1,
        },
      ]
    `);
  });

  it("detail key", () => {
    const key = journalEntriesKeys.detail("tenant-abc", "entry-123");
    expect(key).toMatchInlineSnapshot(`
      [
        "journal-entry",
        "tenant-abc",
        "entry-123",
      ]
    `);
  });
});
