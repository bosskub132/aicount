import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeCookies } from "@/lib/test/cookies";
import { makeTenantId, makeUserId } from "@/lib/test/fixtures";

const assignmentRows = vi.hoisted(() => ({ value: [] as Array<{ role: string }> }));
const whereSpy = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...args: unknown[]) => {
          whereSpy(...args);
          return Promise.resolve(assignmentRows.value);
        },
      }),
    }),
  },
}));

const { getTenantIdFromRequest, WORKSPACE_COOKIE } = await import("./tenant");
const { cookies } = await import("next/headers");

describe("tenant resolver — security", () => {
  beforeEach(() => {
    assignmentRows.value = [];
    whereSpy.mockReset();
    vi.mocked(cookies).mockReset();
  });

  it("does not leak tenant B data to user A who has no assignment for B", async () => {
    const userA = makeUserId();
    const tenantB = makeTenantId();
    const fake = makeFakeCookies([{ name: WORKSPACE_COOKIE, value: tenantB }]);
    vi.mocked(cookies).mockResolvedValue(fake as never);
    assignmentRows.value = [];

    const result = await getTenantIdFromRequest(userA);

    expect(result).toBeNull();
    expect(fake.get(WORKSPACE_COOKIE)).toBeUndefined();
  });

  it("queries assignments scoped to the acting user id (not cookie-derived)", async () => {
    const userA = makeUserId();
    const tenantId = makeTenantId();
    const fake = makeFakeCookies([{ name: WORKSPACE_COOKIE, value: tenantId }]);
    vi.mocked(cookies).mockResolvedValue(fake as never);
    assignmentRows.value = [{ role: "maker" }];

    await getTenantIdFromRequest(userA);

    expect(whereSpy).toHaveBeenCalledOnce();
  });

  it("rejects SQL-injection-ish cookie values before touching DB", async () => {
    const fake = makeFakeCookies([
      { name: WORKSPACE_COOKIE, value: "'; DROP TABLE tenant_assignments; --" },
    ]);
    vi.mocked(cookies).mockResolvedValue(fake as never);

    const result = await getTenantIdFromRequest(makeUserId());

    expect(result).toBeNull();
    expect(whereSpy).not.toHaveBeenCalled();
  });
});
