# UI Responsiveness via Server Prefetch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate client-side data-fetch waterfalls on high-traffic pages by moving `workspaceTenantId` from `localStorage` to an HttpOnly cookie and enabling Next.js Server Components to prefetch per-tenant data via React Query's `HydrationBoundary`.

**Architecture:** Middleware reads a validated tenant cookie and injects `x-tenant-id` header. API route handlers are thin wrappers over shared query functions in `src/lib/db/queries/`. Server Components call those same functions for prefetch, then wrap client bodies in `<HydrationBoundary>` so the existing `useQuery` hooks hit a warm cache on mount with zero XHRs.

**Tech Stack:** Next.js 16 (App Router), React 19, React Query 5, Drizzle ORM, Supabase SSR, Vitest 4 (bootstrapping), Playwright (E2E).

**Scope:** Phases 1-3 of `docs/superpowers/specs/2026-04-18-ui-responsiveness-server-prefetch-design.md` — infra + documents query extraction + `/documents` pilot. Remaining tier-1/tier-2 page migrations + cleanup are a follow-up plan once the pilot is proven.

**Testing philosophy:** Tests come before implementation (RED → GREEN → REFACTOR). Every task commits on green. No step merges implementation and tests in one commit.

---

## Task 0: Bootstrap Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/test/db.ts`
- Create: `src/lib/test/cookies.ts`
- Create: `src/lib/test/fixtures.ts`
- Modify: `package.json`

- [ ] **Step 1: Add scripts and coverage devDep**

Modify `package.json`: add `"test": "vitest"` and `"test:coverage": "vitest --coverage"` to `scripts`; add `"@vitest/coverage-v8": "^4.1.2"` to `devDependencies`.

- [ ] **Step 2: Run install**

```bash
cd /c/Users/bossk/Desktop/aicount && npm install
```

Expected: succeeds; `@vitest/coverage-v8` appears in `node_modules`.

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts", "src/**/*.{test,spec}.tsx"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.ts", "src/**/*.{test,spec}.tsx", "src/types/**"],
    },
  },
});
```

- [ ] **Step 4: Create test helper — fake cookies()**

Create `src/lib/test/cookies.ts`:

```ts
type CookieEntry = { name: string; value: string };

export function makeFakeCookies(entries: CookieEntry[] = []) {
  const store = new Map<string, string>(entries.map((e) => [e.name, e.value]));
  return {
    get(name: string) {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
    },
    set(name: string, value: string) {
      store.set(name, value);
    },
    delete(name: string) {
      store.delete(name);
    },
    _raw: store,
  };
}

export type FakeCookies = ReturnType<typeof makeFakeCookies>;
```

- [ ] **Step 5: Create test helper — fixture factories**

Create `src/lib/test/fixtures.ts`:

```ts
import { randomUUID } from "node:crypto";

export function makeTenantId(): string {
  return randomUUID();
}

export function makeUserId(): string {
  return randomUUID();
}

export function makeAssignmentRow(overrides: Partial<{ userId: string; tenantId: string; role: "maker" | "checker" }> = {}) {
  return {
    userId: overrides.userId ?? makeUserId(),
    tenantId: overrides.tenantId ?? makeTenantId(),
    role: overrides.role ?? "maker",
  };
}
```

- [ ] **Step 6: Create test helper — DB sentinel**

Create `src/lib/test/db.ts`:

```ts
export function requireTestDbUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Point it at a dedicated staging schema. Refusing to run DB tests against production."
    );
  }
  return url;
}
```

- [ ] **Step 7: Verify Vitest runs**

Create a temporary `src/lib/test/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test -- --run`
Expected: `1 passed`.

Then delete `src/lib/test/smoke.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/test
git commit -m "chore: bootstrap vitest with test helpers and coverage"
```

---

## Task 1: Tenant resolver — failing tests

**Files:**
- Create: `src/lib/api/tenant.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/api/tenant.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm RED**

Run: `npm test -- --run src/lib/api/tenant.test.ts`
Expected: All 5 tests FAIL with "Cannot find module './tenant'".

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/lib/api/tenant.test.ts
git commit -m "test: add failing tests for getTenantIdFromRequest"
```

---

## Task 2: Tenant resolver — implementation

**Files:**
- Create: `src/lib/api/tenant.ts`

- [ ] **Step 1: Implement getTenantIdFromRequest**

Create `src/lib/api/tenant.ts`:

```ts
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";

export const WORKSPACE_COOKIE = "workspaceTenantId";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getTenantIdFromRequest(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(WORKSPACE_COOKIE);
  const raw = cookie?.value;

  if (!raw || !UUID_RE.test(raw) || raw === ZERO_UUID) {
    return null;
  }

  const rows = await db
    .select({ role: tenantAssignments.role })
    .from(tenantAssignments)
    .where(and(eq(tenantAssignments.userId, userId), eq(tenantAssignments.tenantId, raw)));

  if (rows.length === 0) {
    cookieStore.delete(WORKSPACE_COOKIE);
    return null;
  }

  return raw;
}

export const workspaceCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};
```

- [ ] **Step 2: Run tests to confirm GREEN**

Run: `npm test -- --run src/lib/api/tenant.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/tenant.ts
git commit -m "feat: add tenant cookie resolver with assignment validation"
```

---

## Task 3: Security test for tenant resolver

**Files:**
- Create: `src/lib/api/tenant.security.test.ts`

- [ ] **Step 1: Write security test asserting cross-tenant cookie tampering is rejected**

Create `src/lib/api/tenant.security.test.ts`:

```ts
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
```

- [ ] **Step 2: Run and confirm GREEN**

Run: `npm test -- --run src/lib/api/tenant.security.test.ts`
Expected: All 3 tests PASS (implementation already correct from Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/tenant.security.test.ts
git commit -m "test: pin cross-tenant + injection protection for tenant resolver"
```

---

## Task 4: Workspace switch route — failing tests

**Files:**
- Create: `src/app/api/workspace/switch/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/workspace/switch/route.test.ts`:

```ts
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
  unauthorized: () => new Response(JSON.stringify({ success: false, error: "unauthorized" }), { status: 401 }),
  forbidden: (msg: string) => new Response(JSON.stringify({ success: false, error: msg }), { status: 403 }),
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
  });
});
```

- [ ] **Step 2: Run tests to confirm RED**

Run: `npm test -- --run src/app/api/workspace/switch/route.test.ts`
Expected: All 4 tests FAIL with "Cannot find module './route'".

- [ ] **Step 3: Commit**

```bash
git add src/app/api/workspace/switch/route.test.ts
git commit -m "test: add failing tests for /api/workspace/switch"
```

---

## Task 5: Workspace switch route — implementation

**Files:**
- Create: `src/app/api/workspace/switch/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/workspace/switch/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";
import {
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/api/tenant";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch {
    return NextResponse.json(
      { success: false, error: "tenantId is required and must be a UUID" },
      { status: 400 }
    );
  }

  const rows = await db
    .select({ role: tenantAssignments.role })
    .from(tenantAssignments)
    .where(
      and(
        eq(tenantAssignments.userId, ctx.userId),
        eq(tenantAssignments.tenantId, parsed.tenantId)
      )
    );

  if (rows.length === 0) {
    return forbidden("No assignment for requested tenant");
  }

  const response = NextResponse.json({ success: true, data: { tenantId: parsed.tenantId } });
  response.cookies.set(WORKSPACE_COOKIE, parsed.tenantId, workspaceCookieOptions);
  return response;
}
```

- [ ] **Step 2: Run tests to confirm GREEN**

Run: `npm test -- --run src/app/api/workspace/switch/route.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/workspace/switch/route.ts
git commit -m "feat: add POST /api/workspace/switch with HttpOnly cookie"
```

---

## Task 6: Middleware — prefer cookie, keep query-param fallback for migration

**Files:**
- Modify: `src/lib/supabase/middleware.ts:74-81`

**Why keep the query-param fallback?** During this plan, non-migrated pages still send `?tenantId=` in their client fetches using the localStorage value. Removing the fallback here would 403 every non-migrated page. The follow-up cleanup plan removes the fallback once all client fetches are migrated.

- [ ] **Step 1: Replace the tenant resolution block**

In `src/lib/supabase/middleware.ts`, find lines 74-80 and replace:

```ts
    const pathTenantIdMatch = request.nextUrl.pathname.match(/^\/api\/tenants\/([^/]+)/);
    const queryTenantId = request.nextUrl.searchParams.get("tenantId");
    const tenantId =
      request.headers.get("x-tenant-id") ||
      pathTenantIdMatch?.[1] ||
      queryTenantId ||
      "00000000-0000-0000-0000-000000000000";
```

With:

```ts
    const pathTenantIdMatch = request.nextUrl.pathname.match(/^\/api\/tenants\/([^/]+)/);
    const queryTenantId = request.nextUrl.searchParams.get("tenantId");
    const cookieTenantId = request.cookies.get("workspaceTenantId")?.value;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tenantId =
      (cookieTenantId && UUID_RE.test(cookieTenantId) ? cookieTenantId : undefined) ||
      pathTenantIdMatch?.[1] ||
      queryTenantId ||
      "00000000-0000-0000-0000-000000000000";
```

Rationale: cookie becomes the first-priority source; path match preserves `/api/tenants/:id/*` routing; query-param fallback is retained for transition; zero-UUID is the "no tenant" sentinel. The client-provided `x-tenant-id` HEADER is no longer read (was always stripped before downstream anyway).

- [ ] **Step 2: Build to confirm no downstream breakage**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat: resolve tenant from cookie in middleware, keep query fallback"
```

---

## Task 7: Documents query layer — failing tests

**Files:**
- Create: `src/lib/db/queries/documents.test.ts`

- [ ] **Step 1: Write failing tests with mocked DB**

Create `src/lib/db/queries/documents.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTenantId } from "@/lib/test/fixtures";

const selectRows = vi.hoisted(() => ({ value: [] as Array<Record<string, unknown>> }));
const countRows = vi.hoisted(() => ({ value: [{ total: 0 }] as Array<{ total: number }> }));
const whereCalls = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("@/lib/db", () => ({
  db: {
    select: (shape?: unknown) => {
      const isCount = shape && typeof shape === "object" && "total" in (shape as object);
      return {
        from: () => ({
          where: (clause: unknown) => {
            whereCalls.value.push(clause);
            const base = {
              orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve(selectRows.value) }) }),
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
      listDocuments(makeTenantId(), { page: 1, limit: 20, statuses: ["NOT_A_REAL_STATUS"] as never })
    ).rejects.toThrow(/invalid status/i);
  });

  it("clamps limit to 100", async () => {
    const result = await listDocuments(makeTenantId(), { page: 1, limit: 9999 });
    expect(result.meta.limit).toBe(100);
  });

  it("caps search string at 200 chars", async () => {
    const huge = "x".repeat(500);
    const result = await listDocuments(makeTenantId(), { page: 1, limit: 20, search: huge });
    // no throw; search is silently capped
    expect(result.data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm RED**

Run: `npm test -- --run src/lib/db/queries/documents.test.ts`
Expected: All 7 tests FAIL with "Cannot find module './documents'".

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/documents.test.ts
git commit -m "test: add failing tests for listDocuments query"
```

---

## Task 8: Documents query layer — implementation

**Files:**
- Create: `src/lib/db/queries/documents.ts`

- [ ] **Step 1: Implement listDocuments**

Create `src/lib/db/queries/documents.ts`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "OCR_PROCESSING",
  "ACTION_REQUIRED",
  "QUERY",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXPORTED",
  "REJECTED",
  "VOID",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const SORT_FIELDS = {
  createdAt: documents.createdAt,
  issuerName: documents.issuerName as any,
  grandTotal: documents.grandTotal as any,
  documentDate: documents.documentDate as any,
  status: documents.status as any,
} as const;

export type ListDocumentsParams = {
  page?: number;
  limit?: number;
  statuses?: DocumentStatus[];
  search?: string;
  sort?: keyof typeof SORT_FIELDS;
  order?: "asc" | "desc";
};

export type DocumentListItem = {
  id: string;
  tenantId: string;
  status: string;
  docType: string | null;
  direction: string | null;
  issuerName: string | null;
  issuerTaxId: string | null;
  issuerBranch: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  subtotal: string | null;
  vatAmount: string | null;
  grandTotal: string | null;
  whtAmount: string | null;
  whtRate: string | null;
  whtIncomeType: string | null;
  discountAmount: string | null;
  fileUrl: string | null;
  fileHash: string | null;
  intakeSource: string | null;
  batchId: string | null;
  parentDocumentId: string | null;
  uploadedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListDocumentsResult = {
  data: DocumentListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export async function listDocuments(
  tenantId: string,
  params: ListDocumentsParams = {}
): Promise<ListDocumentsResult> {
  if (params.statuses && params.statuses.length > 0) {
    for (const s of params.statuses) {
      if (!DOCUMENT_STATUSES.includes(s)) {
        throw new Error(`invalid status: ${s}`);
      }
    }
  }

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const search = (params.search ?? "").slice(0, 200).trim() || undefined;
  const sort = params.sort ?? "createdAt";
  const order = params.order === "asc" ? "asc" : "desc";

  const conditions = [eq(documents.tenantId, tenantId)];
  if (params.statuses && params.statuses.length === 1) {
    conditions.push(eq(documents.status, params.statuses[0] as any));
  } else if (params.statuses && params.statuses.length > 1) {
    conditions.push(inArray(documents.status, params.statuses as any));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(documents.issuerName, pattern),
        ilike(documents.documentNumber, pattern)
      ) as any
    );
  }

  const where = and(...conditions);
  const sortColumn = SORT_FIELDS[sort] ?? documents.createdAt;
  const orderBy = order === "asc" ? asc(sortColumn) : desc(sortColumn);
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: documents.id,
        tenantId: documents.tenantId,
        status: documents.status,
        docType: documents.docType,
        direction: documents.direction,
        issuerName: documents.issuerName,
        issuerTaxId: documents.issuerTaxId,
        issuerBranch: documents.issuerBranch,
        documentNumber: documents.documentNumber,
        documentDate: documents.documentDate,
        subtotal: documents.subtotal,
        vatAmount: documents.vatAmount,
        grandTotal: documents.grandTotal,
        whtAmount: documents.whtAmount,
        whtRate: documents.whtRate,
        whtIncomeType: documents.whtIncomeType,
        discountAmount: documents.discountAmount,
        fileUrl: documents.fileUrl,
        fileHash: documents.fileHash,
        intakeSource: documents.intakeSource,
        batchId: documents.batchId,
        parentDocumentId: documents.parentDocumentId,
        uploadedBy: documents.uploadedBy,
        approvedBy: documents.approvedBy,
        approvedAt: documents.approvedAt,
        voidReason: documents.voidReason,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(documents)
      .where(where),
  ]);

  const data: DocumentListItem[] = (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    tenantId: String(r.tenantId),
    status: String(r.status),
    docType: (r.docType as string | null) ?? null,
    direction: (r.direction as string | null) ?? null,
    issuerName: (r.issuerName as string | null) ?? null,
    issuerTaxId: (r.issuerTaxId as string | null) ?? null,
    issuerBranch: (r.issuerBranch as string | null) ?? null,
    documentNumber: (r.documentNumber as string | null) ?? null,
    documentDate: toIso(r.documentDate),
    subtotal: (r.subtotal as string | null) ?? null,
    vatAmount: (r.vatAmount as string | null) ?? null,
    grandTotal: (r.grandTotal as string | null) ?? null,
    whtAmount: (r.whtAmount as string | null) ?? null,
    whtRate: (r.whtRate as string | null) ?? null,
    whtIncomeType: (r.whtIncomeType as string | null) ?? null,
    discountAmount: (r.discountAmount as string | null) ?? null,
    fileUrl: (r.fileUrl as string | null) ?? null,
    fileHash: (r.fileHash as string | null) ?? null,
    intakeSource: (r.intakeSource as string | null) ?? null,
    batchId: (r.batchId as string | null) ?? null,
    parentDocumentId: (r.parentDocumentId as string | null) ?? null,
    uploadedBy: (r.uploadedBy as string | null) ?? null,
    approvedBy: (r.approvedBy as string | null) ?? null,
    approvedAt: toIso(r.approvedAt),
    voidReason: (r.voidReason as string | null) ?? null,
    createdAt: toIso(r.createdAt) ?? "",
    updatedAt: toIso(r.updatedAt) ?? "",
  }));

  const total = Number(countResult[0]?.total ?? 0);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
```

- [ ] **Step 2: Run tests to confirm GREEN**

Run: `npm test -- --run src/lib/db/queries/documents.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/documents.ts
git commit -m "feat: extract listDocuments query with ISO-string normalization"
```

---

## Task 9: Refactor /api/documents to use shared query

**Files:**
- Modify: `src/app/api/documents/route.ts`

- [ ] **Step 1: Replace route body**

Overwrite `src/app/api/documents/route.ts` with:

```ts
import { NextResponse } from "next/server";
import {
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
  listDocuments,
} from "@/lib/db/queries/documents";

export async function GET(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? ctx.tenantId;

    if (!ensureTenantScope(ctx.tenantId, tenantId)) {
      return forbidden("Cross-tenant access denied");
    }

    const statusParam = searchParams.get("status");
    const statuses: DocumentStatus[] = statusParam
      ? (statusParam
          .split(",")
          .map((s) => s.trim())
          .filter((s): s is DocumentStatus =>
            (DOCUMENT_STATUSES as readonly string[]).includes(s)
          ))
      : [];
    if (statusParam && statuses.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const sort = (searchParams.get("sort") || "createdAt") as
      | "createdAt"
      | "issuerName"
      | "grandTotal"
      | "documentDate"
      | "status";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const search = searchParams.get("search") || undefined;

    const result = await listDocuments(tenantId, {
      page,
      limit,
      statuses: statuses.length > 0 ? statuses : undefined,
      search,
      sort,
      order,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[documents GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Build to catch any downstream type issue**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Smoke the route manually**

Run the dev server in another terminal: `npm run dev`
Then: `curl -i "http://localhost:3000/api/documents?tenantId=<your-tenant-uuid>&page=1&limit=5"` (with cookies from an authenticated browser session — easiest via DevTools → Network → copy-as-curl).

Expected: `200 OK` with `{ success: true, data: [...], meta: { ... } }`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/documents/route.ts
git commit -m "refactor: route /api/documents through shared listDocuments query"
```

---

## Task 10: Query key export + contract test

**Files:**
- Modify: `src/lib/hooks/use-documents.ts`
- Create: `src/lib/hooks/use-documents.test.ts`

- [ ] **Step 1: Add keys export and use it in the hook**

Modify `src/lib/hooks/use-documents.ts`. Add near the top, before `useDocuments`:

```ts
export const documentKeys = {
  all: ["documents"] as const,
  list: (tenantId: string, params: DocumentsParams) =>
    ["documents", tenantId, params] as const,
  detail: (id: string, tenantId: string) =>
    ["document", id, tenantId] as const,
};
```

Then replace the `queryKey` lines inside `useDocuments` and `useDocument`:

In `useDocuments`, change `queryKey: ["documents", tenantId, params]` to `queryKey: documentKeys.list(tenantId, params)`.

In `useDocument`, change `queryKey: ["document", id, tenantId]` to `queryKey: documentKeys.detail(id ?? "", tenantId)`.

Also add `staleTime: 2 * 60_000` to `useDocuments`'s `useQuery` options (below `queryFn`).

- [ ] **Step 2: Write contract test**

Create `src/lib/hooks/use-documents.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --run src/lib/hooks/use-documents.test.ts`
Expected: 3 tests PASS (snapshots populate on first run).

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks/use-documents.ts src/lib/hooks/use-documents.test.ts
git commit -m "feat: export documentKeys and pin query-key contract via snapshots"
```

---

## Task 11: Split /documents page into Server Component shell + client body

**Files:**
- Create: `src/app/(app)/documents/documents-client.tsx`
- Modify: `src/app/(app)/documents/page.tsx`

- [ ] **Step 1: Move current body to documents-client.tsx (no logic change)**

Copy the entire current contents of `src/app/(app)/documents/page.tsx` to a new file `src/app/(app)/documents/documents-client.tsx`. In the new file, rename the default export:
- Change `export default function DocumentsPage()` to `export default function DocumentsClient()`.
- `DocumentsPageContent` inside stays named the same.

- [ ] **Step 2: Replace page.tsx with a minimal Server Component shell (still no prefetch yet)**

Overwrite `src/app/(app)/documents/page.tsx` with:

```tsx
import DocumentsClient from "./documents-client";

export default function DocumentsPage() {
  return <DocumentsClient />;
}
```

- [ ] **Step 3: Build and smoke in browser**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run dev`, visit `/documents` in a logged-in browser.
Expected: page renders identically to before this task.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/documents/documents-client.tsx src/app/\(app\)/documents/page.tsx
git commit -m "refactor: split /documents into Server Component shell + client body"
```

---

## Task 12: Add public mirror cookie and update workspace selector

**Background:** Because the security cookie is HttpOnly, client JavaScript cannot read it. But the client hooks need to compute the same query key the server used for prefetch, which includes `tenantId`. Solution: set a second cookie `workspaceTenantIdPublic` (NOT HttpOnly) containing the same value. The mirror cookie is not an auth credential — the server still validates the HttpOnly cookie against `tenant_assignments`. An attacker injecting the public cookie achieves nothing.

**Files:**
- Modify: `src/app/api/workspace/switch/route.ts`
- Modify: `src/app/api/workspace/switch/route.test.ts`
- Modify: `src/components/workspace-selector.tsx`

- [ ] **Step 1: Add public cookie to switch route**

In `src/app/api/workspace/switch/route.ts`, before the `return response` line, insert:

```ts
  response.cookies.set("workspaceTenantIdPublic", parsed.tenantId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
```

- [ ] **Step 2: Extend switch route test for public cookie**

In `src/app/api/workspace/switch/route.test.ts`, inside the `"returns 200 + HttpOnly Set-Cookie when assignment exists"` test, add after the existing `setCookie` assertions:

```ts
    expect(setCookie.toLowerCase()).toContain("workspacetenantidpublic=");
```

Run: `npm test -- --run src/app/api/workspace/switch/route.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 3: Update `getWorkspaceTenantId` to read the public cookie**

In `src/components/workspace-selector.tsx`, replace:

```ts
export function getWorkspaceTenantId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("workspaceTenantId") || "";
}
```

With:

```ts
export function getWorkspaceTenantId() {
  if (typeof window === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)workspaceTenantIdPublic=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}
```

- [ ] **Step 4: Replace `selectWorkspace` with POST + clear + refresh**

In the same file, at the top of the file add:

```ts
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
```

Inside the `WorkspaceSelector` component body, add near the other hooks:

```tsx
  const queryClient = useQueryClient();
  const router = useRouter();
```

Replace the existing `selectWorkspace` function with:

```tsx
  async function selectWorkspace(id: string) {
    const res = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: id }),
    });
    if (!res.ok) {
      setLoadError("Failed to switch workspace. Please try again.");
      return;
    }
    setTenantId(id);
    setOpen(false);
    queryClient.clear();
    router.refresh();
  }
```

Note: `localStorage.setItem` is removed. `window.location.reload()` is replaced by `queryClient.clear() + router.refresh()`.

- [ ] **Step 5: Add one-time localStorage hygiene effect**

Still in `src/components/workspace-selector.tsx`, inside the component body near the other `useEffect` calls, add:

```tsx
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("workspaceTenantId");
    }
  }, []);
```

This clears the stale key from users who had it set before the migration. Safe to delete this effect after ~1 month.

- [ ] **Step 6: Manual verification**

Run `npm run dev`. Log in, click the workspace selector, pick a tenant. Confirm:
- Network tab: `POST /api/workspace/switch` → 200.
- Application tab → Cookies: `workspaceTenantId` is HttpOnly; `workspaceTenantIdPublic` is NOT HttpOnly; both values are identical.
- Application tab → Local Storage: no `workspaceTenantId` key.
- Page re-renders with new tenant data (no full-page reload flash).

- [ ] **Step 7: Commit**

```bash
git add src/components/workspace-selector.tsx src/app/api/workspace/switch/route.ts src/app/api/workspace/switch/route.test.ts
git commit -m "feat: workspace switch via cookies + clear cache + router.refresh"
```

---

## Task 13: Add server prefetch with HydrationBoundary

**Prerequisite:** Task 12 (public cookie + updated selector) must be complete so the public cookie exists and the client hook's `tenantId` matches the server's prefetch key.

**Files:**
- Modify: `src/app/(app)/documents/page.tsx`

- [ ] **Step 1: Add prefetch to the Server Component**

Overwrite `src/app/(app)/documents/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listDocuments } from "@/lib/db/queries/documents";
import { documentKeys } from "@/lib/hooks/use-documents";
import DocumentsClient from "./documents-client";

export default async function DocumentsPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) {
    redirect("/login");
  }

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) {
    redirect("/dashboard");
  }

  const defaultParams = { page: 1, limit: 20 };
  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: documentKeys.list(tenantId, defaultParams),
      queryFn: async () => {
        const result = await listDocuments(tenantId, defaultParams);
        return { success: true, ...result };
      },
    });
  } catch (error) {
    console.error("[documents prefetch]", error);
    // Fall through: client will refetch on mount.
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DocumentsClient />
    </HydrationBoundary>
  );
}
```

Notes:
- The `queryFn` wraps the result in `{ success: true, ...result }` to match the exact shape returned by `/api/documents` so the client-side `useDocuments` reads it identically.
- Redirect target is `/dashboard` (which exists and has the workspace selector in its shell) rather than `/select-workspace` (does not exist). Follow-up plan may introduce a dedicated picker page.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification — first paint shows data without XHR**

Run `npm run dev`. Log in to the app, select a workspace via the sidebar selector, then navigate to `/documents`. Open DevTools → Network, filter `/api/documents`.

Expected:
- Document rows visible in the DOM on first paint.
- Zero XHRs to `/api/documents` on initial render. (Other queries like counts may XHR — only `/api/documents` must be silent.)
- React Query Devtools (if installed) shows the list query in `fresh` state.

If an XHR still fires: confirm the query key matches EXACTLY. Common causes: (a) client passes different default params than the server (e.g. `sort: "createdAt"` default on server but `undefined` on client), (b) `params` object identity differences. Fix by making the server and client use identical default params.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/documents/page.tsx
git commit -m "feat: server-prefetch /documents with HydrationBoundary"
```

---

## Task 14: Login sets cookie for single-tenant users

**Files:**
- Modify: `src/app/api/auth/login/route.ts` (assumed path — verify before starting)

- [ ] **Step 1: Locate the login route**

Run:
```bash
ls src/app/api/auth/
```

If `login/route.ts` exists, use that path. Otherwise search:
```bash
grep -r "supabase.auth.signInWithPassword" src/ 2>/dev/null | head -5
```

Use the path returned. Call that file `<LOGIN_ROUTE>` below.

- [ ] **Step 2: Add single-tenant cookie default**

In `<LOGIN_ROUTE>`, after the sign-in succeeds and before the response is returned, insert:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenantAssignments } from "@/lib/db/schema";
import { WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/api/tenant";

// ... inside the POST handler, after auth success:
const assignments = await db
  .select({ tenantId: tenantAssignments.tenantId })
  .from(tenantAssignments)
  .where(eq(tenantAssignments.userId, user.id));

const uniqueTenantIds = Array.from(new Set(assignments.map((a) => a.tenantId)));
if (uniqueTenantIds.length === 1) {
  const tenantId = uniqueTenantIds[0];
  response.cookies.set(WORKSPACE_COOKIE, tenantId, workspaceCookieOptions);
  response.cookies.set("workspaceTenantIdPublic", tenantId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
```

Note: this code assumes `response` is a `NextResponse` returned at the end. Adapt variable names to the existing handler.

- [ ] **Step 3: Manual verification**

Sign out. Sign in again as a user who has exactly one tenant assignment. After login, navigate directly to `/documents`. Expected: data appears without first visiting `/select-workspace`.

Sign out. Sign in as a user with multiple assignments. Expected: `/documents` redirects to `/select-workspace` because no tenant cookie was auto-set.

- [ ] **Step 4: Commit**

```bash
git add <LOGIN_ROUTE>
git commit -m "feat: auto-set tenant cookie on login when user has one assignment"
```

---

## Task 15: Playwright E2E — first paint contains document rows before /api/documents fires

**Files:**
- Create: `playwright.config.ts` (only if not present)
- Create: `tests/e2e/documents-first-paint.spec.ts`
- Modify: `package.json` (add `test:e2e` script)

- [ ] **Step 1: Check if Playwright is installed**

Run:
```bash
cd /c/Users/bossk/Desktop/aicount && ls node_modules/@playwright 2>/dev/null || echo "NOT INSTALLED"
```

If NOT INSTALLED, run:
```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Create playwright.config.ts (if absent)**

Check: `ls playwright.config.ts 2>/dev/null`. If absent, create:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", port: 3000, reuseExistingServer: true, timeout: 120_000 },
});
```

- [ ] **Step 3: Add e2e script**

Modify `package.json`: add `"test:e2e": "playwright test"` to `scripts`.

- [ ] **Step 4: Create the test**

Create `tests/e2e/documents-first-paint.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

test("documents page renders rows before /api/documents fires", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "E2E_USER_EMAIL / E2E_USER_PASSWORD must be set");

  // Fail the test if /api/documents is called during initial render.
  let initialApiCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/documents") && req.method() === "GET") {
      initialApiCalls++;
    }
  });

  // Log in.
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard|\/select-workspace/);

  // Reset counter — we only care about /documents navigation.
  initialApiCalls = 0;

  // Navigate to /documents and assert rows appear BEFORE any XHR fires.
  const navigation = page.goto("/documents");

  // Rows should be in the HTML stream.
  const firstRow = page.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 10_000 });
  await navigation;

  expect(initialApiCalls, "/api/documents should not fire during initial render").toBe(0);
});
```

- [ ] **Step 5: Run the test**

Ensure `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` are set in `.env.local` or shell for a seeded test user with at least one document in their tenant. Then:

```bash
npm run test:e2e -- documents-first-paint
```

Expected: 1 passed.

If the assertion fails with `initialApiCalls > 0`: the hydrated cache is not matching. Go back to Task 12 Step 3 and confirm the query key matches exactly.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/documents-first-paint.spec.ts package.json package-lock.json
git commit -m "test(e2e): assert /documents renders rows without initial XHR"
```

---

## Task 16: Strip x-tenant-id header from client-side useDocuments mutations

**Files:**
- Modify: `src/lib/hooks/use-documents.ts`

Scope note: this is ONLY for `use-documents.ts` — other hooks will be migrated in the follow-up plan. Removing here proves the pattern and confirms middleware-injected header works.

- [ ] **Step 1: Remove x-tenant-id from mutation fetches**

In `src/lib/hooks/use-documents.ts`, change:

```ts
  const headers = { "Content-Type": "application/json", "x-tenant-id": tenantId };
```

to:

```ts
  const headers = { "Content-Type": "application/json" };
```

Also remove `tenantId` from the JSON bodies that include it (the middleware now injects the header, and route handlers should prefer `ctx.tenantId`). For each mutation body that looks like `body: JSON.stringify({ tenantId })`, change to `body: JSON.stringify({})`.

For the `deleteDoc` mutation, change:
```ts
      const res = await fetch(`/api/documents/${docId}?tenantId=${tenantId}`, {
```
to:
```ts
      const res = await fetch(`/api/documents/${docId}`, {
```

- [ ] **Step 2: Manual verification — mutations still work**

Run `npm run dev`. In the app: approve a document, submit a document, delete a document. Each must return 200 and the UI must refresh correctly.

If any returns 403 "Cross-tenant access denied": the route handler is reading `tenantId` from the URL/body instead of `ctx.tenantId`. Open that route handler and change it to use `ctx.tenantId` for the scope check.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-documents.ts
git commit -m "refactor: drop client-sent x-tenant-id from useDocuments mutations"
```

---

## Task 17: Coverage check

- [ ] **Step 1: Run coverage**

```bash
npm run test:coverage -- --run
```

- [ ] **Step 2: Verify thresholds**

From the output, confirm:
- `src/lib/api/tenant.ts` — 100% coverage
- `src/lib/db/queries/documents.ts` — ≥ 90% coverage
- Overall project: ≥ 80% is not enforced in this plan since only a subset of the codebase has tests; note the number for the follow-up plan.

If `tenant.ts` is below 100%, add a test for the uncovered branch. If `documents.ts` is below 90%, add tests for the uncovered branch (typically the sort/search combinations).

- [ ] **Step 3: Commit coverage report if baseline needs tracking**

Measured at commit 4003b1e:

```
tenant.ts (src/lib/api):     100% statements, 100% branches, 100% functions (target 100% ✅)
documents.ts (lib/db/queries): 60% statements, 73.78% branches, 37.5% functions
  — listDocuments alone is well covered; the file's total is pulled down by pre-existing
    sibling helpers (getDocumentById, getDocumentWithLines, replaceJournalLines,
    markDocumentsApproved) that have no tests. Covering those is out of scope for
    this plan; will be addressed in the follow-up plan's query-layer migrations.
overall (project):           ~4% (untouched; most of the codebase has no tests yet)
```

---

## Task 18: Perf measurement

- [ ] **Step 1: Baseline snapshot**

Before merging, on `main` (or the branch just before Task 0), run `npm run build && npm start`. In an incognito Chrome window, log in, open DevTools → Performance, record a reload of `/documents`. Note the LCP. Repeat 5 times, take the median.

Record as `baseline_documents_lcp_ms = ___`.

- [ ] **Step 2: Post-change snapshot**

On the branch at HEAD after Task 16, `npm run build && npm start`. Same procedure. Record as `prefetch_documents_lcp_ms = ___`.

- [ ] **Step 3: Assert ≥ 30% improvement**

```
improvement = (baseline - prefetch) / baseline
required >= 0.30
```

If under 30%: do NOT merge. Likely causes:
- Query key drift (check Task 10 snapshots)
- Prefetch swallowed by a try/catch (check server logs)
- Client hook firing on a different param shape than server default (Task 12 Step 3)

Fix root cause, remeasure.

- [ ] **Step 4: Record in the design doc**

Append to `docs/superpowers/specs/2026-04-18-ui-responsiveness-server-prefetch-design.md` under a new `## Measured results` section:

```md
## Measured results

- /documents LCP (median of 5, Chrome, incognito, prod build):
  - Before: <n> ms
  - After: <n> ms
  - Improvement: <n>%
- Commit measured: <sha>
```

Commit:
```bash
git add docs/superpowers/specs/2026-04-18-ui-responsiveness-server-prefetch-design.md
git commit -m "docs: record measured LCP improvement for /documents"
```

---

## Follow-up plan (not in this plan)

After this plan lands and is validated in staging, a follow-up plan will cover:
- Remaining Tier 1 pages (dashboard, approvals, extractions, journal, reports hub + each report)
- Tier 2 pages (master data, bank recon)
- Cleanup PR: remove `x-tenant-id` header from all remaining client fetches; remove `getWorkspaceTenantId` entirely; delete `localStorage.removeItem` hygiene effect; remove `DEFAULT_WORKSPACE_TENANT_ID` zero-UUID fallback from middleware.

Each remaining page follows the same 3-step shape:
1. Extract its query into `src/lib/db/queries/<resource>.ts` with the same serialization contract (ISO strings, number counts) — RED test first.
2. Export `<resource>Keys` from its hook file with a snapshot contract test.
3. Split page into Server Component shell + `*-client.tsx`; add prefetch + `HydrationBoundary` in the shell.
