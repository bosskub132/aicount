# Server-Prefetch Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every piece of tenant-resolution tech debt that the server-prefetch pilot left behind — the redundant `x-tenant-id` header on client fetches, the middleware query-param fallback, the dead `DEFAULT_WORKSPACE_TENANT_ID` zero-UUID export, and the one-shot `localStorage` hygiene effect — so the tenant cookie is the single source of truth.

**Architecture:** Zero functional change. All mutations are localized removals of fallback paths now that the cookie-based flow is the only supported path. Each task has a test that either (a) asserts the removal took effect via grep, or (b) confirms the existing test suite remains green.

**Tech Stack:** TypeScript, Next.js 16 middleware, Vitest, bash (grep).

**Scope:** Follow-up plan A of four, spawned from `docs/superpowers/specs/2026-04-18-ui-responsiveness-server-prefetch-design.md`. Plans B, C, D cover per-page migrations. This plan is independent of all three and safe to land first.

---

## Task 0: Pre-flight audit

**Files:** none (read-only baseline)

- [ ] **Step 1: Capture the current state as a baseline for later removal assertions**

Run:
```bash
cd /c/Users/bossk/Desktop/aicount
grep -RIn '"x-tenant-id"' src/lib/hooks src/app 2>/dev/null | grep -v ":\s*//" | wc -l
grep -RIn "DEFAULT_WORKSPACE_TENANT_ID" src 2>/dev/null | wc -l
grep -RIn "queryTenantId" src/lib/supabase/middleware.ts 2>/dev/null | wc -l
grep -RIn 'localStorage.removeItem\("workspaceTenantId"\)' src 2>/dev/null | wc -l
```

Record the four numbers. Expected rough baseline (from last audit):
```
x-tenant-id references: ~29
DEFAULT_WORKSPACE_TENANT_ID references: 2 (src/components/workspace-selector.tsx)
queryTenantId in middleware: 1
localStorage.removeItem hygiene: 1
```

The end of this plan asserts all four reach zero.

- [ ] **Step 2: Confirm Vitest + build are green before we start**

Run:
```bash
npm test -- --run
npm run build
```

Expected: 115 tests passing, build compiles.

- [ ] **Step 3: Commit nothing — this is read-only**

No changes yet.

---

## Task 1: Strip `x-tenant-id` from React Query hooks

**Files:**
- Modify: `src/lib/hooks/use-dashboard.ts`
- Modify: `src/lib/hooks/use-export.ts`
- Modify: `src/lib/hooks/use-suggestions.ts`
- Modify: `src/lib/hooks/use-ai-usage.ts`

These four hook files set the `x-tenant-id` header on outbound fetches. The middleware already injects the server-side `x-tenant-id` from the cookie; the client copy is redundant and now dead.

- [ ] **Step 1: Remove the header from `use-dashboard.ts`**

In `src/lib/hooks/use-dashboard.ts`, find every occurrence of `headers: { "x-tenant-id": tenantId },` (three total per earlier audit) and replace each with `headers: {},` OR remove the `headers` key entirely from the `fetch` call.

Minimal example of the pattern — if the current code is:
```ts
const res = await fetch(`/api/dashboard?tenantId=${tenantId}`, {
  headers: { "x-tenant-id": tenantId },
});
```
change to:
```ts
const res = await fetch(`/api/dashboard?tenantId=${tenantId}`);
```

Do this for every `fetch(...)` call in the file.

- [ ] **Step 2: Same in `use-export.ts`**

Remove every `"x-tenant-id": tenantId` entry from `headers` objects in this file.

- [ ] **Step 3: Same in `use-suggestions.ts`**

Remove every `"x-tenant-id": tenantId` entry.

- [ ] **Step 4: Same in `use-ai-usage.ts`**

Remove every `"x-tenant-id": tenantId` entry.

- [ ] **Step 5: Run tests and build**

```bash
npm test -- --run
npm run build
```

Expected: 115 tests passing, build clean. Nothing tests these specific header removals (they're side-band), so a green suite proves no regression.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/use-dashboard.ts src/lib/hooks/use-export.ts src/lib/hooks/use-suggestions.ts src/lib/hooks/use-ai-usage.ts
git commit -m "refactor: drop redundant x-tenant-id header from React Query hooks"
```

---

## Task 2: Strip `x-tenant-id` from app page client fetches (onboarding + settings)

**Files:**
- Modify: `src/app/(app)/upload/page.tsx`
- Modify: `src/app/(app)/extractions/page.tsx`
- Modify: `src/app/(app)/ledger/page.tsx`
- Modify: `src/app/(app)/settings/accounting/ai-usage/page.tsx`
- Modify: `src/app/(app)/settings/accounting/bank-recon/page.tsx`
- Modify: `src/app/(app)/settings/accounting/period-locks/page.tsx`
- Modify: `src/app/(app)/settings/accounting/tax-reports/page.tsx`
- Modify: `src/app/(app)/settings/accounting/templates/page.tsx`
- Modify: `src/app/(app)/settings/masterdata/coa/page.tsx`
- Modify: `src/app/(app)/settings/masterdata/customers/page.tsx`
- Modify: `src/app/(app)/settings/masterdata/departments/page.tsx`
- Modify: `src/app/(app)/settings/masterdata/products/page.tsx`
- Modify: `src/app/(app)/settings/masterdata/vendors/page.tsx`
- Modify: `src/app/(app)/settings/workspace/delete/page.tsx`
- Modify: `src/app/(app)/settings/workspace/general/page.tsx`
- Modify: `src/app/(app)/settings/workspace/invitations/page.tsx`
- Modify: `src/app/(app)/settings/workspace/members/page.tsx`
- Modify: `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx`
- Modify: `src/app/(onboarding)/onboarding/departments/page.tsx`
- Modify: `src/app/(onboarding)/onboarding/team/page.tsx`
- Modify: `src/app/(onboarding)/onboarding/template/page.tsx`
- Modify: `src/app/(onboarding)/onboarding/vendors-customers/page.tsx`

Same pattern as Task 1, but in page-level `fetch(...)` calls rather than hook files.

- [ ] **Step 1: For each file above, remove all `"x-tenant-id": tenantId` entries**

The idiomatic pattern to hunt and remove:
```ts
headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
```
becomes:
```ts
headers: { "Content-Type": "application/json" },
```

Or if the only header was `x-tenant-id`:
```ts
headers: { "x-tenant-id": tenantId },
```
becomes:
```ts
headers: {},  // or drop the headers key entirely
```

Do NOT remove the `tenantId` from URL query strings (`?tenantId=${id}`) or request bodies — those are removed in Task 4 after the middleware is locked down.

- [ ] **Step 2: Run tests and build**

```bash
npm test -- --run
npm run build
```

Expected: 115 tests passing, build clean.

- [ ] **Step 3: Manual smoke**

Run `npm run dev`. Log in. Click through:
- `/settings/masterdata/coa` — COA list loads
- `/settings/workspace/members` — member list loads
- `/extractions` — extraction list loads

Any 403 "Cross-tenant access denied" response means the route handler on the other end is reading tenantId from a place we haven't touched yet (URL/body). Note which route and proceed — we'll catch it in Task 4.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)" "src/app/(onboarding)"
git commit -m "refactor: drop redundant x-tenant-id header from client page fetches"
```

---

## Task 3: Add regression test asserting no client-side `x-tenant-id` header

**Files:**
- Create: `src/lib/test/no-client-tenant-header.test.ts`

This guards against future regressions — any new client fetch that adds `x-tenant-id` will fail CI.

- [ ] **Step 1: Write the test**

Create `src/lib/test/no-client-tenant-header.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("no client-side x-tenant-id headers", () => {
  it("no file under src/app or src/lib/hooks sets the x-tenant-id header", () => {
    const root = path.resolve(__dirname, "../../..");
    const dirs = [
      path.join(root, "src", "app"),
      path.join(root, "src", "lib", "hooks"),
    ];
    const offenders: Array<{ file: string; lineNo: number; line: string }> = [];

    for (const dir of dirs) {
      for (const file of walk(dir)) {
        // Skip middleware and request-context — those are server-side and
        // allowed to inject x-tenant-id headers downstream.
        if (file.includes("middleware") || file.includes("request-context")) continue;
        const content = readFileSync(file, "utf8");
        if (!content.includes("x-tenant-id")) continue;
        content.split(/\r?\n/).forEach((line, i) => {
          if (line.includes('"x-tenant-id"') || line.includes("'x-tenant-id'")) {
            offenders.push({ file, lineNo: i + 1, line: line.trim() });
          }
        });
      }
    }

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  ${o.file}:${o.lineNo}\n    ${o.line}`)
        .join("\n\n");
      throw new Error(
        `Found ${offenders.length} client-side x-tenant-id references.\n` +
          `Middleware injects x-tenant-id from the cookie; client code must not set it.\n\n` +
          report
      );
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test — expect PASS**

```bash
npm test -- --run src/lib/test/no-client-tenant-header.test.ts
```

Expected: 1 passed. If it fails, Tasks 1 and 2 left something behind — fix those offenders and retry.

- [ ] **Step 3: Commit**

```bash
git add src/lib/test/no-client-tenant-header.test.ts
git commit -m "test: pin that client code never sets x-tenant-id header"
```

---

## Task 4: Remove query-param fallback from middleware

**Files:**
- Modify: `src/lib/supabase/middleware.ts:74-82`

Currently middleware falls back to `?tenantId=` and path-param `/api/tenants/:id/*`. The cookie is the primary; path-param is still needed for `/api/tenants/:id/*` routes; the query-param fallback is now dead.

- [ ] **Step 1: Remove the `queryTenantId` branch**

In `src/lib/supabase/middleware.ts`, find:

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

Replace with:

```ts
    const pathTenantIdMatch = request.nextUrl.pathname.match(/^\/api\/tenants\/([^/]+)/);
    const cookieTenantId = request.cookies.get("workspaceTenantId")?.value;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tenantId =
      (cookieTenantId && UUID_RE.test(cookieTenantId) ? cookieTenantId : undefined) ||
      pathTenantIdMatch?.[1] ||
      "00000000-0000-0000-0000-000000000000";
```

(Two deletions: the `queryTenantId` variable assignment, and the `queryTenantId ||` branch.)

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual smoke — log in and click through**

Run `npm run dev`. Log in, pick a workspace. Visit:
- `/documents`
- `/settings/masterdata/coa`
- `/bank-recon`
- `/approvals`

All should load. Any 403 means a client fetch is still relying on `?tenantId=` in the URL. That's expected to come from routes where the route handler reads `searchParams.get("tenantId")` and compares via `ensureTenantScope(ctx.tenantId, requestedTenantId)` — the cookie-derived `ctx.tenantId` now overrides. The route handler stays the same; only the middleware changed.

If you DO hit 403s, the fix is in the failing client fetch, not in the middleware. Remove the `?tenantId=${id}` from that specific fetch and re-test.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "refactor: drop query-param tenantId fallback from middleware"
```

---

## Task 5: Drop tenantId from URL query strings on client fetches

**Files:**
- Scan: all `.ts` and `.tsx` files under `src/app/(app)/` and `src/lib/hooks/`
- Each file with a `?tenantId=${...}` or `&tenantId=${...}` pattern needs it removed.

- [ ] **Step 1: Find every offender**

Run:
```bash
grep -RIn 'tenantId=\${' src/app src/lib/hooks 2>/dev/null
```

This lists every fetch URL that still includes `?tenantId=` or `&tenantId=`. The middleware no longer reads it (Task 4), and the route handler's `ensureTenantScope` now validates against the cookie-derived `ctx.tenantId`, so the query param is dead weight.

- [ ] **Step 2: For each file above, remove `tenantId=` from URLs**

The rewrite pattern:

```ts
// Before
const res = await fetch(`/api/dashboard?tenantId=${tenantId}`);

// After
const res = await fetch(`/api/dashboard`);
```

Or when there are more query params:

```ts
// Before
const sp = new URLSearchParams({ tenantId, page: String(page), limit: String(limit) });

// After
const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
```

If the URL had `tenantId` as the only param, drop the `?`:
```ts
// Before
const res = await fetch(`/api/documents/${id}?tenantId=${tenantId}`);

// After
const res = await fetch(`/api/documents/${id}`);
```

Do NOT touch URLs of the form `/api/tenants/${tenantId}/...` — those are path params, still required by middleware to match `/api/tenants/:id/*`.

- [ ] **Step 3: Run tests and build**

```bash
npm test -- --run
npm run build
```

Expected: 115 tests passing, build clean. The `no-client-tenant-header` test from Task 3 does NOT check URL query strings, so this task isn't guarded by it — manual regression is required.

- [ ] **Step 4: Manual smoke**

Run `npm run dev`. Click through a representative set of pages:
- Dashboard (`/dashboard`) — cards load
- Documents list (`/documents`) — rows load, approve/reject work
- Extractions (`/extractions`) — list loads
- Settings / Master Data / Vendors — list loads
- Bank Recon (`/bank-recon`) — page loads

Any 403 or empty page is likely a fetch this task missed. Grep for it and fix.

- [ ] **Step 5: Commit**

```bash
git add -A src/app src/lib/hooks
git commit -m "refactor: drop tenantId query-param from client fetches"
```

---

## Task 6: Delete `DEFAULT_WORKSPACE_TENANT_ID` and `isDefaultWorkspaceTenantId` exports

**Files:**
- Modify: `src/components/workspace-selector.tsx:6-10`

The zero-UUID sentinel is only useful server-side (to reject unvalidated requests). On the client, it's legacy from the old "empty localStorage equals zero UUID" world. With the cookie flow, the client never sees the zero UUID.

- [ ] **Step 1: Find consumers**

```bash
grep -RIn "DEFAULT_WORKSPACE_TENANT_ID\|isDefaultWorkspaceTenantId" src 2>/dev/null
```

Expected: two call sites on top of the exports themselves:
- `src/components/workspace-selector.tsx` uses `isDefaultWorkspaceTenantId` internally to show "Select client" warning state when `tenantId` is empty

(If any other file imports them, handle those first.)

- [ ] **Step 2: Inline the check and drop the exports**

In `src/components/workspace-selector.tsx`, find:

```ts
export const DEFAULT_WORKSPACE_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export function isDefaultWorkspaceTenantId(id: string | null | undefined) {
  return !id || id === DEFAULT_WORKSPACE_TENANT_ID;
}
```

Delete those two exports.

Then find the internal consumer:

```ts
const unsetClient = isDefaultWorkspaceTenantId(tenantId) && workspaces.length > 0;
```

Change to:

```ts
const unsetClient = !tenantId && workspaces.length > 0;
```

(The cookie-based `getWorkspaceTenantId` never returns a zero UUID — if no cookie is set, it returns `""`. So the check simplifies to truthiness.)

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace-selector.tsx
git commit -m "refactor: delete DEFAULT_WORKSPACE_TENANT_ID; cookie flow never emits it"
```

---

## Task 7: Remove client `tenantId` gates in React Query hooks

**Files:**
- Modify: `src/lib/hooks/use-documents.ts`
- Modify: `src/lib/hooks/use-dashboard.ts`
- Modify: `src/lib/hooks/use-export.ts`
- Modify: `src/lib/hooks/use-suggestions.ts`
- Modify: `src/lib/hooks/use-ai-usage.ts`
- Modify: `src/lib/hooks/use-account-ledger.ts`
- Modify: `src/lib/hooks/use-balance-sheet.ts`
- Modify: `src/lib/hooks/use-bank-recon.ts`
- Modify: `src/lib/hooks/use-bank-recon-statements.ts`
- Modify: `src/lib/hooks/use-cash-flow.ts`
- Modify: `src/lib/hooks/use-gl-detail.ts`
- Modify: `src/lib/hooks/use-journal-entries.ts`
- Modify: `src/lib/hooks/use-journal-listing.ts`
- Modify: `src/lib/hooks/use-monthly-comparison.ts`
- Modify: `src/lib/hooks/use-payables.ts`
- Modify: `src/lib/hooks/use-payments.ts`
- Modify: `src/lib/hooks/use-profit-loss.ts`
- Modify: `src/lib/hooks/use-receivables.ts`
- Modify: `src/lib/hooks/use-report-history.ts`
- Modify: `src/lib/hooks/use-report-retention.ts`
- Modify: `src/lib/hooks/use-tax-pnd3.ts`
- Modify: `src/lib/hooks/use-tax-pnd53.ts`
- Modify: `src/lib/hooks/use-tax-pp30.ts`
- Modify: `src/lib/hooks/use-tax-pp36.ts`
- Modify: `src/lib/hooks/use-trial-balance.ts`
- Modify: `src/lib/hooks/use-vat-register.ts`
- Modify: `src/lib/hooks/use-wht-certificates.ts`
- Modify: `src/lib/hooks/use-wht-uncertified.ts`

Every hook has this pattern:

```ts
enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
```

The zero-UUID check is dead. With the cookie flow, `getWorkspaceTenantId()` returns either a real UUID or `""` — never zero UUID.

- [ ] **Step 1: For each file, simplify the `enabled` guard**

Replace every occurrence of:

```ts
enabled: !!tenantId && tenantId !== "00000000-0000-0000-0000-000000000000",
```

With:

```ts
enabled: !!tenantId,
```

Some hooks have compound guards (e.g., `enabled: !!id && !!tenantId && tenantId !== "00000000-..."`). Preserve the other clauses; only drop the zero-UUID check.

- [ ] **Step 2: Run tests and build**

```bash
npm test -- --run
npm run build
```

Expected: 115 passing, build clean. `useDocuments` snapshot tests from the pilot are unaffected because the snapshot covers the query key, not the `enabled` expression.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks
git commit -m "refactor: drop zero-UUID check from hook enabled guards"
```

---

## Task 8: Remove the `localStorage.removeItem` hygiene effect

**Files:**
- Modify: `src/components/workspace-selector.tsx:65-70`

The hygiene effect was a transitional cleanup to wipe stale `localStorage.workspaceTenantId` values from users upgrading from the pre-cookie era. Pilot shipped to 2-3 users on ~2026-04-18; after two weeks that key is gone for good.

- [ ] **Step 1: Delete the effect**

In `src/components/workspace-selector.tsx`, find:

```ts
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("workspaceTenantId");
    }
  }, []);
```

Delete the whole effect block.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace-selector.tsx
git commit -m "chore: remove localStorage hygiene effect (grace period elapsed)"
```

---

## Task 9: Final regression

**Files:** none modified

- [ ] **Step 1: Full test suite + coverage**

```bash
npm run test:coverage -- --run
```

Expected: 116 tests passing (115 previous + the new grep-guard from Task 3). `src/lib/api/tenant.ts` still at 100%; no regression on `listDocuments`.

- [ ] **Step 2: Full production build**

```bash
npm run build
```

Expected: succeeds, no type errors.

- [ ] **Step 3: End-of-plan audit (repeat Task 0 commands)**

```bash
grep -RIn '"x-tenant-id"' src/lib/hooks src/app 2>/dev/null | grep -v ":\s*//" | wc -l
grep -RIn "DEFAULT_WORKSPACE_TENANT_ID" src 2>/dev/null | wc -l
grep -RIn "queryTenantId" src/lib/supabase/middleware.ts 2>/dev/null | wc -l
grep -RIn 'localStorage.removeItem\("workspaceTenantId"\)' src 2>/dev/null | wc -l
```

Expected: all four outputs are `0`. If any non-zero, backtrack to the responsible task.

- [ ] **Step 4: Final commit if coverage report changed**

If `npm run test:coverage` altered any file (it shouldn't — coverage outputs are gitignored), nothing to commit.

- [ ] **Step 5: Summary**

Plan A closes out with:
- Zero client-side tenant headers
- Zero tenant query params
- Middleware reads cookie only (+ path for `/api/tenants/:id/*`)
- No `DEFAULT_WORKSPACE_TENANT_ID` export
- No hygiene effect
- New Vitest grep guard prevents regression

Next: Plans B, C, D migrate remaining pages to server-prefetch on top of this clean foundation.
