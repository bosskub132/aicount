import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeUserId } from "@/lib/test/fixtures";

const ctxMock = vi.hoisted(() => ({
  value: null as { userId: string; tenantId: string; ipAddress?: string } | null,
}));

vi.mock("@/lib/api/request-context", () => ({
  getRequestContext: () => ctxMock.value,
  unauthorized: () => new Response(null, { status: 401 }),
  forbidden: (msg: string) => new Response(msg, { status: 403 }),
  ensureTenantScope: (a: string, b: string) => a === b,
}));

const patchMock = vi.hoisted(() => ({
  called: false,
  args: null as unknown,
  returns: null as unknown,
}));

vi.mock("@/lib/db/queries/tenants", () => ({
  patchTenantOnboarding: (args: unknown) => {
    patchMock.called = true;
    patchMock.args = args;
    return Promise.resolve(patchMock.returns);
  },
}));

vi.mock("@/lib/services/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: "t-1", onboardingStep: 3, isOnboardingComplete: false }],
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  tenants: { id: "tenants.id", onboardingStep: "tenants.onboarding_step", isOnboardingComplete: "tenants.is_onboarding_complete" },
}));

vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));

const { PATCH } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/tenants/t-1/onboarding", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/tenants/[id]/onboarding", () => {
  beforeEach(() => {
    patchMock.called = false;
    patchMock.args = null;
    patchMock.returns = { id: "t-1", onboardingStep: 3, isOnboardingComplete: false };
    ctxMock.value = { userId: makeUserId(), tenantId: "t-1" };
  });

  it("returns 401 without context", async () => {
    ctxMock.value = null;
    const res = await PATCH(makeRequest({ onboardingStep: 3 }), {
      params: Promise.resolve({ id: "t-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when [id] does not match ctx.tenantId", async () => {
    ctxMock.value = { userId: makeUserId(), tenantId: "t-other" };
    const res = await PATCH(makeRequest({ onboardingStep: 3 }), {
      params: Promise.resolve({ id: "t-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("400 on invalid step", async () => {
    const res = await PATCH(makeRequest({ onboardingStep: 99 }), {
      params: Promise.resolve({ id: "t-1" }),
    });
    expect(res.status).toBe(400);
    expect(patchMock.called).toBe(false);
  });

  it("happy path calls patchTenantOnboarding with id + body", async () => {
    const res = await PATCH(
      makeRequest({ onboardingStep: 3, isOnboardingComplete: true }),
      { params: Promise.resolve({ id: "t-1" }) }
    );
    expect(res.status).toBe(200);
    expect(patchMock.called).toBe(true);
    expect(patchMock.args).toEqual({
      tenantId: "t-1",
      onboardingStep: 3,
      isOnboardingComplete: true,
    });
  });
});
