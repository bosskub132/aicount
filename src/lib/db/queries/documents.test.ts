import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTenantId } from "@/lib/test/fixtures";

const selectRows = vi.hoisted(() => ({ value: [] as Array<Record<string, unknown>> }));
const countRows = vi.hoisted(() => ({ value: [{ total: 0 }] as Array<{ total: number }> }));
const whereCalls = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("@/lib/db", () => ({
  db: {
    select: (shape?: unknown) => {
      const isCount =
        shape && typeof shape === "object" && "total" in (shape as object);
      return {
        from: () => ({
          where: (clause: unknown) => {
            whereCalls.value.push(clause);
            const base = {
              orderBy: () => ({
                limit: () => ({ offset: () => Promise.resolve(selectRows.value) }),
              }),
            };
            return isCount ? Promise.resolve(countRows.value) : base;
          },
        }),
      };
    },
  },
}));

const { listDocuments } = await import("./documents");

describe("listDocuments", () => {
  beforeEach(() => {
    selectRows.value = [];
    countRows.value = [{ total: 0 }];
    whereCalls.value = [];
  });

  it("returns empty data + zero total when no rows match", async () => {
    const tenantId = makeTenantId();
    const result = await listDocuments(tenantId, { page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
  });

  it("returns data and paginated meta", async () => {
    const tenantId = makeTenantId();
    selectRows.value = [
      {
        id: "doc-1",
        tenantId,
        status: "DRAFT",
        createdAt: new Date("2026-04-19T10:00:00Z"),
        documentDate: new Date("2026-04-19T00:00:00Z"),
      },
    ];
    countRows.value = [{ total: 42 }];

    const result = await listDocuments(tenantId, { page: 2, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 42, page: 2, limit: 20, totalPages: 3 });
  });

  it("normalizes Date fields to ISO strings (hydration-safe)", async () => {
    const tenantId = makeTenantId();
    selectRows.value = [
      {
        id: "doc-1",
        tenantId,
        status: "DRAFT",
        createdAt: new Date("2026-04-19T10:00:00Z"),
        updatedAt: new Date("2026-04-19T11:00:00Z"),
        documentDate: new Date("2026-04-19T00:00:00Z"),
        approvedAt: null,
      },
    ];

    const result = await listDocuments(tenantId, { page: 1, limit: 20 });

    expect(typeof result.data[0].createdAt).toBe("string");
    expect(result.data[0].createdAt).toBe("2026-04-19T10:00:00.000Z");
    expect(result.data[0].approvedAt).toBeNull();
  });

  it("normalizes count to number (never bigint)", async () => {
    const tenantId = makeTenantId();
    countRows.value = [{ total: 5 }];
    const result = await listDocuments(tenantId, { page: 1, limit: 20 });
    expect(typeof result.meta.total).toBe("number");
  });

  it("rejects invalid status values", async () => {
    await expect(
      listDocuments(makeTenantId(), {
        page: 1,
        limit: 20,
        statuses: ["NOT_A_REAL_STATUS"] as never,
      })
    ).rejects.toThrow(/invalid status/i);
  });

  it("clamps limit to 100", async () => {
    const result = await listDocuments(makeTenantId(), { page: 1, limit: 9999 });
    expect(result.meta.limit).toBe(100);
  });

  it("caps search string at 200 chars", async () => {
    const huge = "x".repeat(500);
    const result = await listDocuments(makeTenantId(), {
      page: 1,
      limit: 20,
      search: huge,
    });
    expect(result.data).toEqual([]);
  });
});
