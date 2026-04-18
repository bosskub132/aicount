import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTenantId, makeUserId } from "@/lib/test/fixtures";

const assignmentRows = vi.hoisted(() => ({ value: [] as Array<{ role: string }> }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(assignmentRows.value),
      }),
    }),
  },
}));

vi.mock("@/lib/api/request-context", () => ({
  getRequestContext: vi.fn(),
  unauthorized: () =>
    new Response(JSON.stringify({ success: false, error: "unauthorized" }), { status: 401 }),
  forbidden: (msg: string) =>
    new Response(JSON.stringify({ success: false, error: msg }), { status: 403 }),
}));

const { POST } = await import("./route");
const { getRequestContext } = await import("@/lib/api/request-context");

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/workspace/switch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/workspace/switch", () => {
  beforeEach(() => {
    assignmentRows.value = [];
    vi.mocked(getRequestContext).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getRequestContext).mockReturnValue(null);
    const res = await POST(makePostRequest({ tenantId: makeTenantId() }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body has no tenantId", async () => {
    vi.mocked(getRequestContext).mockReturnValue({
      userId: makeUserId(),
      userEmail: null,
      tenantId: "00000000-0000-0000-0000-000000000000",
      role: "maker",
      ipAddress: null,
      isSuperadmin: false,
    });
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user has no assignment for the requested tenant", async () => {
    const userId = makeUserId();
    const tenantId = makeTenantId();
    vi.mocked(getRequestContext).mockReturnValue({
      userId,
      userEmail: null,
      tenantId: "00000000-0000-0000-0000-000000000000",
      role: "maker",
      ipAddress: null,
      isSuperadmin: false,
    });
    assignmentRows.value = [];

    const res = await POST(makePostRequest({ tenantId }));
    expect(res.status).toBe(403);
  });

  it("returns 200 + HttpOnly Set-Cookie when assignment exists", async () => {
    const userId = makeUserId();
    const tenantId = makeTenantId();
    vi.mocked(getRequestContext).mockReturnValue({
      userId,
      userEmail: null,
      tenantId: "00000000-0000-0000-0000-000000000000",
      role: "maker",
      ipAddress: null,
      isSuperadmin: false,
    });
    assignmentRows.value = [{ role: "maker" }];

    const res = await POST(makePostRequest({ tenantId }));

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`workspaceTenantId=${tenantId}`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie.toLowerCase()).toContain("path=/");
    expect(setCookie.toLowerCase()).toContain("workspacetenantidpublic=");
  });
});
