import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeCookies } from "@/lib/test/cookies";
import { makeTenantId, makeUserId } from "@/lib/test/fixtures";

const assignmentRows = vi.hoisted(() => ({ value: [] as Array<{ role: string }> }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(assignmentRows.value),
      }),
    }),
  },
}));

const { getTenantIdFromRequest, WORKSPACE_COOKIE } = await import("./tenant");
const { cookies } = await import("next/headers");

describe("getTenantIdFromRequest", () => {
  beforeEach(() => {
    assignmentRows.value = [];
    vi.mocked(cookies).mockReset();
  });

  it("returns null when cookie is missing", async () => {
    const fake = makeFakeCookies([]);
    vi.mocked(cookies).mockResolvedValue(fake as never);

    const result = await getTenantIdFromRequest(makeUserId());

    expect(result).toBeNull();
  });

  it("returns null when cookie value is not a UUID", async () => {
    const fake = makeFakeCookies([{ name: WORKSPACE_COOKIE, value: "not-a-uuid" }]);
    vi.mocked(cookies).mockResolvedValue(fake as never);

    const result = await getTenantIdFromRequest(makeUserId());

    expect(result).toBeNull();
  });

  it("returns null and clears cookie when user has no assignment", async () => {
    const fake = makeFakeCookies([{ name: WORKSPACE_COOKIE, value: makeTenantId() }]);
    vi.mocked(cookies).mockResolvedValue(fake as never);
    assignmentRows.value = [];

    const result = await getTenantIdFromRequest(makeUserId());

    expect(result).toBeNull();
    expect(fake.get(WORKSPACE_COOKIE)).toBeUndefined();
  });

  it("returns tenantId when user has an assignment", async () => {
    const tenantId = makeTenantId();
    const fake = makeFakeCookies([{ name: WORKSPACE_COOKIE, value: tenantId }]);
    vi.mocked(cookies).mockResolvedValue(fake as never);
    assignmentRows.value = [{ role: "maker" }];

    const result = await getTenantIdFromRequest(makeUserId());

    expect(result).toBe(tenantId);
  });

  it("rejects zero UUID even if present in cookie", async () => {
    const fake = makeFakeCookies([
      { name: WORKSPACE_COOKIE, value: "00000000-0000-0000-0000-000000000000" },
    ]);
    vi.mocked(cookies).mockResolvedValue(fake as never);

    const result = await getTenantIdFromRequest(makeUserId());

    expect(result).toBeNull();
  });
});
