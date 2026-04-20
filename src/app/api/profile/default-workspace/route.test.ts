import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTenantId, makeUserId } from "@/lib/test/fixtures";

const ctxMock = vi.hoisted(() => ({
  value: null as { userId: string; tenantId: string; ipAddress?: string } | null,
}));

vi.mock("@/lib/api/request-context", () => ({
  getRequestContext: () => ctxMock.value,
  unauthorized: () => new Response(null, { status: 401 }),
  forbidden: (msg: string) => new Response(msg, { status: 403 }),
}));

vi.mock("@/lib/services/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const assignmentsMock = vi.hoisted(() => ({ value: [] as { tenantId: string }[] }));
const updateMock = vi.hoisted(() => ({ called: false, setValues: null as unknown }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => assignmentsMock.value }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => {
        updateMock.called = true;
        updateMock.setValues = values;
        return { where: () => ({ returning: async () => [{}] }) };
      },
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  tenantAssignments: { tenantId: "x", userId: "x" },
  profiles: { id: "x", defaultTenantId: "x", updatedAt: "x" },
}));

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: () => ({}),
}));

const { PATCH } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/profile/default-workspace", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/profile/default-workspace", () => {
  beforeEach(() => {
    ctxMock.value = { userId: makeUserId(), tenantId: makeTenantId() };
    assignmentsMock.value = [];
    updateMock.called = false;
    updateMock.setValues = null;
  });

  it("401 without auth", async () => {
    ctxMock.value = null;
    const res = await PATCH(makeRequest({ tenantId: makeTenantId() }));
    expect(res.status).toBe(401);
  });

  it("403 when user has no assignment to target tenant", async () => {
    assignmentsMock.value = [];
    const res = await PATCH(makeRequest({ tenantId: makeTenantId() }));
    expect(res.status).toBe(403);
    expect(updateMock.called).toBe(false);
  });

  it("200 when tenant is in user's assignments", async () => {
    const tid = makeTenantId();
    assignmentsMock.value = [{ tenantId: tid }];
    const res = await PATCH(makeRequest({ tenantId: tid }));
    expect(res.status).toBe(200);
    expect(updateMock.called).toBe(true);
  });

  it("200 when tenantId is null (clearing default)", async () => {
    const res = await PATCH(makeRequest({ tenantId: null }));
    expect(res.status).toBe(200);
    expect(updateMock.called).toBe(true);
  });
});
