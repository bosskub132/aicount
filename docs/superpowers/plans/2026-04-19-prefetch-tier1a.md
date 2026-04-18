# Server-Prefetch Tier 1a (Dashboard / Approvals / Extractions)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `/dashboard`, `/approvals`, and `/extractions` to the server-prefetch pattern established by the `/documents` pilot — each page becomes a Server Component shell that prefetches its primary query via React Query's `HydrationBoundary`, so rows are in first paint with zero XHRs.

**Architecture:** Each page is split into `page.tsx` (async Server Component that resolves tenant via cookie, prefetches via the existing `src/lib/db/queries/*` function, and wraps a `HydrationBoundary`) + `<page-name>-client.tsx` (the current client body, moved verbatim). The matching hook in `src/lib/hooks/` exports a `keys` object consumed by both the server prefetch and the client `useQuery` — identical keys are the cache-hit invariant.

**Tech Stack:** Next.js 16 App Router, React Query 5 `HydrationBoundary`, Drizzle ORM, Vitest snapshot tests for the query-key contract.

**Scope:** Follow-up plan B of four. Depends on Plan A (cleanup) being merged first so we start from a clean tenant-resolution baseline. Independent of Plans C and D.

**Reference implementation:** `/documents` pilot — see `src/app/(app)/documents/page.tsx` (Server Component shell) and `src/lib/hooks/use-documents.ts` (keys export + inline snapshot contract test).

---

## Task 0: Pre-flight

- [ ] **Step 1: Confirm we're on a cookie-clean base (Plan A merged)**

```bash
cd /c/Users/bossk/Desktop/aicount
grep -RIn '"x-tenant-id"' src/lib/hooks src/app 2>/dev/null | grep -v "request-context\|middleware" | wc -l
grep -RIn "queryTenantId" src/lib/supabase/middleware.ts 2>/dev/null | wc -l
```

Both should be `0`. If not, land Plan A (`2026-04-19-prefetch-cleanup.md`) first.

- [ ] **Step 2: Green baseline**

```bash
npm test -- --run
npm run build
```

Expected: all tests passing, build clean.

---

## Task 1: `/dashboard` — add keys export + snapshot contract tests

**Files:**
- Modify: `src/lib/hooks/use-dashboard.ts`
- Create: `src/lib/hooks/use-dashboard.test.ts`

`use-dashboard.ts` exports three hooks (`useMonthlyComparison`, `useStatusBreakdown`, `useApprovalQueue`). Each needs a stable key the server prefetch can target. We prefetch only `useMonthlyComparison` (the LCP element — the chart) because it's the largest content; the other two arrive client-side and are fast enough.

- [ ] **Step 1: Add `dashboardKeys` export**

At the top of `src/lib/hooks/use-dashboard.ts`, after the imports, add:

```ts
export const dashboardKeys = {
  monthlyComparison: (tenantId: string, months: number) =>
    ["monthly-comparison", tenantId, months] as const,
  statusBreakdown: (tenantId: string) =>
    ["status-breakdown", tenantId] as const,
  approvalQueue: (tenantId: string) =>
    ["approval-queue", tenantId] as const,
};
```

Then update each hook's `queryKey` to call the factory (replacing the inline array literal), and add `staleTime: 60_000` to the `useQuery` options:

```ts
// useMonthlyComparison
queryKey: dashboardKeys.monthlyComparison(tenantId, months),
// ...
enabled: !!tenantId,
staleTime: 60_000,

// useStatusBreakdown
queryKey: dashboardKeys.statusBreakdown(tenantId),
// ...
enabled: !!tenantId,
staleTime: 60_000,

// useApprovalQueue
queryKey: dashboardKeys.approvalQueue(tenantId),
// ...
enabled: !!tenantId,
staleTime: 30_000,
```

- [ ] **Step 2: Write snapshot contract test (RED by absence, GREEN on first run)**

Create `src/lib/hooks/use-dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dashboardKeys } from "./use-dashboard";

describe("dashboardKeys (contract)", () => {
  it("monthlyComparison key — server prefetch and client useQuery MUST agree", () => {
    const key = dashboardKeys.monthlyComparison(
      "11111111-1111-1111-1111-111111111111",
      6
    );
    expect(key).toMatchInlineSnapshot(`
      [
        "monthly-comparison",
        "11111111-1111-1111-1111-111111111111",
        6,
      ]
    `);
  });

  it("statusBreakdown key", () => {
    const key = dashboardKeys.statusBreakdown("tenant-abc");
    expect(key).toMatchInlineSnapshot(`
      [
        "status-breakdown",
        "tenant-abc",
      ]
    `);
  });

  it("approvalQueue key", () => {
    const key = dashboardKeys.approvalQueue("tenant-abc");
    expect(key).toMatchInlineSnapshot(`
      [
        "approval-queue",
        "tenant-abc",
      ]
    `);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run src/lib/hooks/use-dashboard.test.ts
```

Expected: 3 passing. If snapshot mismatches, someone changed the key shape — align server and client before moving on.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks/use-dashboard.ts src/lib/hooks/use-dashboard.test.ts
git commit -m "feat(dashboard): export dashboardKeys + snapshot contract"
```

---

## Task 2: `/dashboard` — split into Server Component shell + client body

**Files:**
- Create: `src/app/(app)/dashboard/dashboard-client.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Copy current `page.tsx` verbatim to `dashboard-client.tsx`**

```bash
cp "src/app/(app)/dashboard/page.tsx" "src/app/(app)/dashboard/dashboard-client.tsx"
```

- [ ] **Step 2: In `dashboard-client.tsx`, rename the default export**

Open `src/app/(app)/dashboard/dashboard-client.tsx`. Find the default export line (looks like `export default function DashboardPage()` or similar) and rename it to `DashboardClient`.

- [ ] **Step 3: Replace `page.tsx` with a minimal shell (no prefetch yet)**

Overwrite `src/app/(app)/dashboard/page.tsx` with:

```tsx
import DashboardClient from "./dashboard-client";

export default function DashboardPage() {
  return <DashboardClient />;
}
```

- [ ] **Step 4: Build and smoke**

```bash
npm run build
```

Run `npm run dev`, visit `/dashboard`. Should look identical to before — this task is pure refactor.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/dashboard"
git commit -m "refactor(dashboard): split into Server Component shell + client body"
```

---

## Task 3: `/dashboard` — add server prefetch + `HydrationBoundary`

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

Now convert the shell to an async Server Component that prefetches the monthly-comparison chart data.

- [ ] **Step 1: Identify the data function**

`useMonthlyComparison` fetches from `/api/tenants/${tenantId}/reports/monthly-comparison?months=${months}`. Inspect that route handler to find the underlying DB function. In this codebase it lives in `src/lib/db/queries/` (likely `monthly-comparison.ts` or similar — confirm with `ls src/lib/db/queries/`).

If the DB function exists, import it directly. If not, prefetch via the fetch API as a fallback (the key still matches; just slower prefetch).

- [ ] **Step 2: Overwrite `page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { dashboardKeys } from "@/lib/hooks/use-dashboard";
import DashboardClient from "./dashboard-client";

const DEFAULT_MONTHS = 6;

export default async function DashboardPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) redirect("/dashboard"); // will end in a 'select client' shown by layout

  const queryClient = new QueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: dashboardKeys.monthlyComparison(tenantId, DEFAULT_MONTHS),
      queryFn: async () => {
        // Prefetch via the SAME API the client hook uses — guarantees identical
        // response shape for hydration. If this ever becomes slow, switch to a
        // direct import from src/lib/db/queries/.
        const internalUrl = new URL(
          `/api/tenants/${tenantId}/reports/monthly-comparison?months=${DEFAULT_MONTHS}`,
          `http://localhost:${process.env.PORT ?? 3000}`
        );
        const res = await fetch(internalUrl, {
          headers: { "x-tenant-id": tenantId, "x-user-id": userId },
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        return json.data;
      },
    });
  } catch (error) {
    console.error("[dashboard prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
```

**Why fetch-based prefetch:** `/dashboard` pulls from `/api/tenants/:id/reports/monthly-comparison` which aggregates across multiple tables. Calling `fetch` from the Server Component re-uses the existing route's aggregation logic. Slower than a direct DB call, but correct and consistent with the client.

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`. DevTools → Network, filter `monthly-comparison`, navigate to `/dashboard`.

Expected:
- Chart renders on first paint (no skeleton flash)
- Zero XHRs to `/api/tenants/:id/reports/monthly-comparison` during initial render. (The other two queries — status-breakdown, approval-queue — WILL fire because we didn't prefetch them; that's intentional.)

If an XHR still fires for monthly-comparison, the server prefetch and client key are drifting. Check the snapshot test output vs the key the client computes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): server-prefetch monthly-comparison chart"
```

---

## Task 4: `/approvals` — add keys export + snapshot contract

**Files:**
- Modify: `src/lib/hooks/use-documents.ts` (add `documentKeys.approvalQueue`) OR create `src/lib/hooks/use-approvals.ts` if a dedicated hook exists.
- Create: `src/lib/hooks/use-approvals.test.ts` (if a new hook file exists)

First check which hook `/approvals` uses:
```bash
grep -Rn "useApprovalQueue\|approval-queue\|api/documents/approval-queue" "src/app/(app)/approvals/"
```

The `useApprovalQueue` hook already lives in `src/lib/hooks/use-dashboard.ts` and we added `dashboardKeys.approvalQueue` in Task 1 — that's the one `/approvals` uses.

- [ ] **Step 1: Verify `/approvals/page.tsx` imports `useApprovalQueue`**

```bash
grep -n "useApprovalQueue" "src/app/(app)/approvals/page.tsx"
```

If yes, we already have `dashboardKeys.approvalQueue` — nothing to add. Skip to Task 5.

If `/approvals` uses a different hook, add a keys export for that hook following the same pattern from Task 1 and write a snapshot contract test mirroring `use-dashboard.test.ts` Step 2.

- [ ] **Step 2: Commit (only if you added anything)**

```bash
git add src/lib/hooks
git commit -m "feat(approvals): keys export + snapshot contract"
```

---

## Task 5: `/approvals` — split into Server Component shell + client body

**Files:**
- Create: `src/app/(app)/approvals/approvals-client.tsx`
- Modify: `src/app/(app)/approvals/page.tsx`

- [ ] **Step 1: Copy and rename**

```bash
cp "src/app/(app)/approvals/page.tsx" "src/app/(app)/approvals/approvals-client.tsx"
```

In `approvals-client.tsx`, rename the default export to `ApprovalsClient`.

- [ ] **Step 2: Minimal shell**

Overwrite `src/app/(app)/approvals/page.tsx`:

```tsx
import ApprovalsClient from "./approvals-client";

export default function ApprovalsPage() {
  return <ApprovalsClient />;
}
```

- [ ] **Step 3: Build and smoke**

```bash
npm run build
```

Run `npm run dev`, visit `/approvals`. Behaves identically.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/approvals"
git commit -m "refactor(approvals): split into Server Component shell + client body"
```

---

## Task 6: `/approvals` — server prefetch

**Files:**
- Modify: `src/app/(app)/approvals/page.tsx`

- [ ] **Step 1: Overwrite with prefetch shell**

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { dashboardKeys } from "@/lib/hooks/use-dashboard";
import ApprovalsClient from "./approvals-client";

export default async function ApprovalsPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) redirect("/dashboard");

  const queryClient = new QueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: dashboardKeys.approvalQueue(tenantId),
      queryFn: async () => {
        const internalUrl = new URL(
          `/api/documents/approval-queue?tenantId=${tenantId}`,
          `http://localhost:${process.env.PORT ?? 3000}`
        );
        const res = await fetch(internalUrl, {
          headers: { "x-tenant-id": tenantId, "x-user-id": userId },
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        return json.data;
      },
    });
  } catch (error) {
    console.error("[approvals prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApprovalsClient />
    </HydrationBoundary>
  );
}
```

- [ ] **Step 2: Build and verify first-paint**

```bash
npm run build
```

Run `npm run dev`. Log in. DevTools → Network, filter `approval-queue`. Navigate to `/approvals`.

Expected: rows visible on first paint, zero XHRs to `/api/documents/approval-queue` during initial render.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/approvals/page.tsx"
git commit -m "feat(approvals): server-prefetch approval queue"
```

---

## Task 7: `/extractions` — add keys export + snapshot contract

**Files:**
- Modify: `src/lib/hooks/use-documents.ts` (re-use existing `documentKeys`)
- Check: `src/app/(app)/extractions/page.tsx`

`/extractions` is a filtered view of documents — likely re-uses `useDocuments` with a status filter. The `documentKeys.list` factory from the pilot already covers it.

- [ ] **Step 1: Verify what `/extractions` fetches**

```bash
grep -n "useDocuments\|use-documents" "src/app/(app)/extractions/page.tsx" | head -10
```

If the page uses `useDocuments({ status: "...", ... })`, then `documentKeys.list(tenantId, params)` already covers it — no new keys needed.

If it uses a different hook, add a keys export for that hook following Task 1's pattern.

- [ ] **Step 2: Commit (only if anything changed)**

If no changes: skip this commit.

---

## Task 8: `/extractions` — split into Server Component shell + client body

**Files:**
- Create: `src/app/(app)/extractions/extractions-client.tsx`
- Modify: `src/app/(app)/extractions/page.tsx`

- [ ] **Step 1: Copy and rename**

```bash
cp "src/app/(app)/extractions/page.tsx" "src/app/(app)/extractions/extractions-client.tsx"
```

Rename the default export to `ExtractionsClient`.

- [ ] **Step 2: Minimal shell**

```tsx
import ExtractionsClient from "./extractions-client";

export default function ExtractionsPage() {
  return <ExtractionsClient />;
}
```

- [ ] **Step 3: Build and smoke**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/extractions"
git commit -m "refactor(extractions): split into Server Component shell + client body"
```

---

## Task 9: `/extractions` — server prefetch

**Files:**
- Modify: `src/app/(app)/extractions/page.tsx`

`/extractions` lists documents in pre-approval states. We prefetch the first page of the default filter.

- [ ] **Step 1: Identify the client's default params**

Open `src/app/(app)/extractions/extractions-client.tsx`. Find the `useDocuments({ ... })` call. Note the default params the hook is called with on first render (page, limit, status filter, sort, order).

- [ ] **Step 2: Write shell with matching params**

Overwrite `src/app/(app)/extractions/page.tsx` (replace `<client params>` with the exact object the client uses):

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listDocuments } from "@/lib/db/queries/documents";
import { documentKeys } from "@/lib/hooks/use-documents";
import ExtractionsClient from "./extractions-client";

export default async function ExtractionsPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");

  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) redirect("/dashboard");

  // IMPORTANT: match the default useDocuments params in extractions-client.tsx
  // exactly. See DocumentsPageContent in the pilot for the pattern. Include
  // `undefined` fields explicitly so the key hashes the same as the client.
  const clientParams = {
    page: 1,
    limit: 100,
    search: undefined,
    status: "ACTION_REQUIRED,OCR_PROCESSING,QUERY", // whatever the client uses
  };

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: documentKeys.list(tenantId, clientParams),
      queryFn: async () => {
        const result = await listDocuments(tenantId, {
          page: clientParams.page,
          limit: clientParams.limit,
          statuses: clientParams.status?.split(",") as never,
        });
        return { success: true, ...result };
      },
    });
  } catch (error) {
    console.error("[extractions prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExtractionsClient />
    </HydrationBoundary>
  );
}
```

Revise `clientParams` to match the exact shape `extractions-client.tsx` passes to `useDocuments` on first render.

- [ ] **Step 3: Build and verify first-paint**

```bash
npm run build
```

Run `npm run dev`. DevTools → Network, filter `documents`. Navigate to `/extractions`.

Expected: rows visible on first paint, zero XHRs to `/api/documents` during initial render.

If an XHR fires, inspect the React Query devtools to see what key the client computed vs what the server prefetched. Align `clientParams` in the Server Component with the exact shape the client passes.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/extractions/page.tsx"
git commit -m "feat(extractions): server-prefetch extraction queue"
```

---

## Task 10: Regression + E2E

- [ ] **Step 1: Full Vitest suite**

```bash
npm test -- --run
```

Expected: all previous + the new `use-dashboard.test.ts` passing.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Manual first-paint smoke for each page**

Run `npm run dev`. Log in. For each of:
- `/dashboard`
- `/approvals`
- `/extractions`

Open DevTools → Network, filter on that page's primary API call, navigate, confirm zero XHRs fire during initial render.

- [ ] **Step 4: E2E extension (optional but recommended)**

Extend `tests/e2e/documents-first-paint.spec.ts` or duplicate it into `tests/e2e/dashboard-first-paint.spec.ts` / `approvals-first-paint.spec.ts` / `extractions-first-paint.spec.ts` to assert the same invariant for these pages.

Template for a new spec (replace `<page>`, `<api path>`, and row selector):

```ts
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

test("<page> renders without initial XHR", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "credentials missing");

  let apiCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("<api path>") && req.method() === "GET") apiCalls++;
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);

  apiCalls = 0;
  await page.goto("/<page>");
  await expect(page.locator("<row selector>").first()).toBeVisible({ timeout: 10_000 });
  expect(apiCalls, "no XHR during initial render").toBe(0);
});
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e
git commit -m "test(e2e): first-paint assertions for dashboard/approvals/extractions"
```

---

## Notes on divergence from the pilot

- **`/dashboard`** prefetches via internal HTTP fetch, not direct DB call. The aggregation in `/api/tenants/:id/reports/monthly-comparison` is complex and not extracted to `src/lib/db/queries/`. If perf is inadequate, extract the aggregation to a query function and switch the `queryFn` to call it directly. Expected cost: ~1 extra roundtrip per initial render; acceptable given the perf win from hydrating the chart in first paint.
- **`/approvals`** similarly prefetches via internal fetch.
- **`/extractions`** uses the existing `listDocuments` query directly — most efficient path.
- If any page has multiple hooks, prefetch ONLY the primary/largest one. Prefetching all queries increases TTFB without a proportional UX win.
