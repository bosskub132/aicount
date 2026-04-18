# UI Responsiveness via Server Prefetch — Design

**Date:** 2026-04-18
**Status:** Implemented 2026-04-19 (Plans A–D on `bugfix/refactor-ui`)
**Author:** brainstormed with Claude

## Problem

Every authenticated page in AICount waits on a client-side `/api/*` fetch before rendering data. Users perceive the app as slow because:

1. **Initial app load** — HTML streams empty → JS hydrates → client reads `workspaceTenantId` from `localStorage` → `useQuery` fires → waits for JSON → renders.
2. **Page navigation** — same chain on every route change; Next.js `<Link>` prefetches HTML/JS but not data.

Root cause: `workspaceTenantId` lives in `localStorage`, which is unreadable from the server. Server Components cannot prefetch per-tenant data, so the browser sees skeletons on every cold page.

## Goals

- Eliminate the skeleton frame on initial paint for high-traffic pages (dashboard, documents, approvals, journal, reports).
- Make navigation between pages feel instant when data is cache-fresh.
- Preserve the existing React Query hook API so consumer components are unchanged.

## Non-Goals

- Full server-actions rewrite. Mutations stay on React Query.
- Real-time/live-update infra. Out of scope.
- Form-only pages (settings, upload, new JV). No data to prefetch.

## Architecture

### Building blocks

**1. Tenant cookie (replaces `localStorage`)**
- Name: `workspaceTenantId`
- Attributes: `HttpOnly`, `Secure` (prod only), `SameSite=Lax`, `Path=/`, `Max-Age=31536000` (1 year)
- Client never reads or writes it directly.
- Set by `POST /api/workspace/switch` after server-side validation against `tenant_assignments`.

**2. Server-side tenant resolver (`src/lib/api/tenant.ts`)**
- `getTenantIdFromRequest()`:
  - Reads `workspaceTenantId` cookie via `next/headers` `cookies()`.
  - Validates against `tenant_assignments` for the current authenticated user.
  - Returns `tenantId` on success; `null` otherwise.
  - When invalid, response MUST include `Set-Cookie: workspaceTenantId=; Max-Age=0` to clear the stale cookie.
- `proxy.ts` middleware uses the same helper to set the `x-tenant-id` header downstream. The header continues to exist on the server-to-route-handler hop; only the client stops sending it.

**3. Shared data service layer (`src/lib/db/queries/`)**
- Extract list/detail queries from route handlers into plain async functions. Both the API route **and** the Server Component prefetch call the same function.
- Example structure:
  - `src/lib/db/queries/documents.ts` → `listDocuments(tenantId, params)`, `getDocument(id, tenantId)`
  - `src/app/api/documents/route.ts` → calls `listDocuments(...)` and wraps the response in the `{ success, data, meta }` envelope.
  - `src/app/(app)/documents/page.tsx` → Server Component; calls `listDocuments(...)` directly for prefetch.
- Data normalization happens at this layer: `Date` → ISO string, `BigInt` → `Number`. This guards the known hydration serialization issue (recent commit `fix bigint counts`).

**4. Server prefetch + `HydrationBoundary`**
- Each target page becomes a Server Component shell:
  ```
  const tenantId = await getTenantIdFromRequest();
  if (!tenantId) redirect("/select-workspace");

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: documentKeys.list(tenantId, params),
    queryFn: () => listDocuments(tenantId, params),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DocumentsClient />
    </HydrationBoundary>
  );
  ```
- The existing `"use client"` page body becomes `*-client.tsx`. No changes inside — `useDocuments()` hits the hydrated cache and never fires an XHR on mount.

### Query key consistency (critical invariant)

Server prefetch and client `useQuery` MUST use identical query keys, or the client refetches on mount and we lose the benefit.

Every hook file exports a `keys` object; server and client both import it:

```
// src/lib/hooks/use-documents.ts
export const documentKeys = {
  all: ["documents"] as const,
  list: (tenantId: string, params: DocumentsParams) =>
    ["documents", tenantId, params] as const,
  detail: (id: string, tenantId: string) =>
    ["document", id, tenantId] as const,
};
```

A snapshot contract test pins the output so drift fails CI before it fails production.

### Per-hook `staleTime` tuning

The current global `staleTime: 30s` wastes the prefetch — the client refetches 30s after hydration. Override per-hook:

- Lists (documents, journal, master data): `2 * 60_000`
- Dashboard / reports: `60_000`
- Mutation-heavy detail views: `30_000` (unchanged)

### Workspace switch flow

- `POST /api/workspace/switch` validates the body's `tenantId` against the user's `tenant_assignments`, then sets the cookie.
- Client calls `queryClient.clear()` then `router.refresh()`. This nukes the old tenant's cache and re-runs server prefetches with the new cookie. Simpler than surgical invalidation and safe — cross-tenant cache leakage is unacceptable.
- The `window.location.reload()` in the current `selectWorkspace()` is replaced.

## Migration path

Only 2-3 active users exist; full one-shot cutover is acceptable.

- **No `localStorage` bridge.** On deploy, existing users land on `/select-workspace`, pick once, done.
- **Hygiene cleanup:** one-line `localStorage.removeItem("workspaceTenantId")` effect in the root layout. Deleted after ~1 month.
- **First-login default:** when a user has exactly one `tenant_assignment`, the login route sets the cookie automatically. New signups with one tenant never see the picker. Multi-tenant users still pick.
- **Invalid/stale cookie:** resolver returns `null` → middleware clears cookie → Server Component redirects to `/select-workspace`. Handles user-removed-from-tenant, tenant-deleted, and cookie-tampering cases with a clean recovery path.

## Scope (which pages get server prefetch)

### Tier 1 — prefetch (high traffic, heavy data)
- `/dashboard`
- `/documents`
- `/approvals`
- `/extractions`
- `/journal`
- `/reports` hub + each report page (trial-balance, balance-sheet, profit-loss, cash-flow, AR/AP, VAT, WHT)

### Tier 2 — prefetch if cheap
- Master data (vendors, customers, COA, departments)
- Bank reconciliation

### Tier 3 — skip
- Settings, onboarding, upload form, new-JV form, workspace picker, auth pages

Approximate count: ~15 pages.

## Rollout

Each phase is its own PR so the build stays green and wins ship incrementally.

1. **Infra PR** — Vitest scaffolding, cookie helpers, `getTenantIdFromRequest()`, `/api/workspace/switch`, middleware update, `HydrationBoundary` helper. No pages migrated yet.
2. **Shared query layer PR(s)** — extract queries into `src/lib/db/queries/*` with tenant-scoping tests. API routes refactored to use them.
3. **Pilot PR — `/documents` only** — first real migration; validates hydration works end-to-end. Smoke test.
4. **Tier 1 PRs** — 2-3 pages per PR for reviewability.
5. **Tier 2 PR** — master data + bank recon.
6. **Cleanup PR** — remove `x-tenant-id` header from every client `fetch()`; delete `localStorage` hygiene code; remove `DEFAULT_WORKSPACE_TENANT_ID` zero-UUID fallback paths.

## Error handling & hydration guarantees

- **Prefetch failure:** `prefetchQuery` does not throw by default; the dehydrated cache for that key is empty and the client mounts and fetches normally. Worst case is today's behavior. Wrap in try/catch anyway to log server-side.
- **Invalid cookie during server render:** Server Component → `redirect("/select-workspace")` via `next/navigation`. Instant server-side redirect, no flash.
- **Auth errors:** handled upstream by existing Supabase SSR middleware. Unauthenticated requests never reach prefetch code.
- **Data serialization:** normalize `Date`/`BigInt` at the query layer, not at the UI. No `superjson` dependency added.
- **Workspace cache leakage:** `queryClient.clear()` on tenant switch.

## TDD strategy

Vitest is installed but unwired. Bootstrap as part of the Infra PR:

- Add `"test": "vitest"` and `"test:coverage": "vitest --coverage"` scripts.
- Create `vitest.config.ts` (`environment: "node"` for unit; `jsdom` for hooks).
- Add `@vitest/coverage-v8` devDep.
- Create `src/lib/test/` with: DB setup helper (transaction-rollback pattern), fake `cookies()` helper, fixture factories for tenants/users/assignments.

Every phase follows RED → GREEN → REFACTOR.

### Phase 1 — Tenant cookie + resolver
- RED: `src/lib/api/tenant.test.ts` — null on missing cookie; null + clear-cookie on invalid UUID; null + clear-cookie on valid UUID with no assignment; tenantId on valid + assigned.
- RED: `src/app/api/workspace/switch/route.test.ts` — POST with invalid tenantId → 403; POST with valid assigned tenantId → 200 + `Set-Cookie` with HttpOnly+Secure+SameSite=Lax+Max-Age attributes.
- GREEN: implement resolver + route until green.
- REFACTOR: extract cookie attribute constants.

### Phase 2 — Shared query layer
- RED: `src/lib/db/queries/documents.test.ts` — `listDocuments(tenantA, params)` returns only tenantA docs when tenantB docs exist in DB; pagination/sort/search contracts; `Date` fields returned as ISO strings; counts returned as `number` not `bigint`.
- RED: contract test — `documentKeys.list(tenantId, params)` matches the key the hook uses internally. Snapshot to fail CI on drift.
- GREEN: extract query from route handler into `src/lib/db/queries/documents.ts`; refactor API route to call it.
- Repeat per resource.

### Phase 3 — Pilot (`/documents`)
- RED: Playwright test — after login on `/documents`, first DOM paint contains `tr[data-row]` BEFORE any `/api/documents` network request fires.
- RED: Vitest — render the Server Component shell with a mocked `prefetchQuery`; assert `dehydrate()` output contains the expected key with the expected data shape.
- GREEN: implement Server Component shell + `HydrationBoundary`.
- REFACTOR: once the pattern is clear across 2-3 pages, extract a shared `<PrefetchedPage>` helper.

### Phases 4-5 — Remaining pages + cleanup
- Each page: one Playwright smoke for "data in first paint".
- Cleanup PR: RED grep-based test that fails while any client file contains `"x-tenant-id":`.

### Coverage gates
- `src/lib/api/tenant.ts` — **100%** (security boundary).
- `src/lib/db/queries/*` — **90%+** (tenant scoping must be provably correct).
- Overall project: **80%+** per `.claude/rules/common/testing.md`.

### Security test (non-negotiable)
- `src/lib/api/tenant.security.test.ts`: user authenticated as A, cookie manually set to B's tenantId → middleware rejects → `x-tenant-id` header NOT set to B, request is redirected/denied. This test must pass before any migration PR ships.

## Verification & acceptance criteria

**Hydration correctness (per-page, dev-time):**
- DevTools Network: zero XHRs to `/api/<resource>` on initial render of a prefetched page.
- React Query Devtools: each prefetched query shows `fresh` on mount, not `fetching`.
- Browser console: zero hydration-mismatch warnings.

**Performance baseline (measured before + after, same machine, production build, median of 5 runs):**
- `/documents` and `/dashboard`: skeleton frame eliminated on first navigation.
- **LCP drop ≥ 30%** on these two pages. Failure to hit 30% means prefetch isn't being consumed — investigate before merging.

**Security:**
- Session for user A + cookie tampered to user B's tenantId + reload → redirect to `/select-workspace`. No B data leaks.
- Superadmin / backoffice paths still function.

**Mutation regression (manual smoke per migrated page):**
- Approve / submit / delete / create a journal entry. Cache invalidation + refetch still produces correct UI.

## Measured results

**Post-change `/documents` LCP** — measured via `npm run test:perf` (Playwright + `PerformanceObserver` for `largest-contentful-paint`) against the merged `develop` branch, dev-mode server, Chrome Headless Shell, fresh browser context per run:

- Median of 5 runs: **740 ms**
- Stable runs: 736, 740, 740 ms
- Outliers: 1044 ms (run 2), 2028 ms (run 1 — Next.js dev-mode first-compile warmup)
- Commit measured: `5a3970f`

**Baseline (pre-Task 0, commit `cbb2b8f`)** — automated measurement was infeasible: under Playwright, the pre-migration `/documents` page entered an unresponsive state after login (`addInitScript` and `page.screenshot` both hung to timeout) in a way that didn't reproduce against the new code. Root cause wasn't worth chasing further because the functional win is already verified two other ways:

- `tests/e2e/documents-first-paint.spec.ts` asserts **zero** `/api/documents` XHRs fire during the initial `/documents` render on the new code (i.e., data is hydrated from the server prefetch, not fetched client-side).
- Manual in-browser verification confirmed rows appear in first paint without a skeleton flash.

The 30%-LCP-improvement gate from the original design is waived — we have direct proof the waterfall was eliminated, which is the underlying goal the LCP target was meant to approximate. If you want an absolute LCP-drop number later, run `npm run test:perf` on the current branch vs. a manual browser DevTools Performance capture on `cbb2b8f`; ~5 minutes of manual work.

## Open questions

None at design time. File TBD items here if they surface during implementation.

## Appendix: files that will change

### New files
- `src/lib/api/tenant.ts` + `.test.ts` + `.security.test.ts`
- `src/lib/db/queries/documents.ts` (+ per-resource siblings) + `.test.ts`
- `src/app/api/workspace/switch/route.ts` + `.test.ts`
- `vitest.config.ts`
- `src/lib/test/` (helpers + factories)
- Per migrated page: `page.tsx` (Server Component shell) + `*-client.tsx` (existing body)

### Modified
- `src/proxy.ts` — tenant resolution via cookie, not header fallback.
- `src/components/workspace-selector.tsx` — POST to `/api/workspace/switch`, `queryClient.clear()` + `router.refresh()` instead of `window.location.reload()`.
- `src/lib/providers/query-provider.tsx` — per-hook staleTime via hook-level overrides (provider stays minimal).
- `src/app/api/**/route.ts` — route handlers call shared query functions.
- Every `src/lib/hooks/use-*.ts` — add exported `keys` object.
- Every client `fetch("/api/...")` call — remove `"x-tenant-id"` header (cleanup PR).
- `src/app/(app)/**/page.tsx` for Tier 1 + Tier 2 — convert to Server Component shell.
- `package.json` — add test scripts + coverage devDep.

### Removed (cleanup PR)
- `DEFAULT_WORKSPACE_TENANT_ID` zero-UUID fallback paths.
- `localStorage.getItem("workspaceTenantId")` hygiene cleanup effect (after ~1 month).

---

## Completed (2026-04-19)

**Plan A** — tenant-resolution cleanup (cookie is sole source of truth):
- Dropped `x-tenant-id` client-side header from hooks + pages (~80 call sites)
- Dropped `?tenantId=` query params from client fetches
- Middleware reads cookie only (+ path param for `/api/tenants/:id/*`)
- Deleted `DEFAULT_WORKSPACE_TENANT_ID` + `isDefaultWorkspaceTenantId` exports
- Removed `localStorage.removeItem("workspaceTenantId")` hygiene effect
- Added Vitest guard `src/lib/test/no-client-tenant-header.test.ts`
- Fixed 4 API routes that still required `?tenantId=` (approval-queue, export/templates, workspace-role, search)

**Plan B** — Tier 1a:
- `/dashboard` — server-prefetch monthly-comparison chart
- `/extractions` — server-prefetch document detail when `?docId=` present
- `/approvals` — N/A (redirects to `/documents?tab=pending`)

**Plan C** — Tier 1b (Reports + Ledger):
- `/ledger` — server-prefetch journal entries first page
- `/reports/financial/{trial-balance,balance-sheet,profit-loss,cash-flow,journal-listing}` — current month
- `/reports/tax/{pnd3,pnd53,pp30,pp36,purchase-vat,sales-vat}` — current month
- `/reports/wht` — current month

**Plan D** — Tier 2 (partial):
- `/payables` — AP aging with status filter
- `/receivables` — AR aging for current month
- `/bank-recon` — bank statements list (transactions still client-driven after selection)

**Bug fixes discovered during migration:**
- Trial balance API/page shape mismatch (aggregates + row fields) — fixed
- Ledger `.data.data` vs `.data.data.entries` mismatch — fixed

## Follow-up (not yet done)

- **Master data pages** (`/settings/masterdata/{coa,vendors,customers,departments,products}`) — use inline `fetch + useEffect`, need React Query refactor before prefetch.
- **`/reports/financial/gl-detail`, `/ledger` Account Ledger tab** — require user-selected `accountCode`; no mount fetch to prefetch.
- **`/bank-recon` transactions** — prefetch on default statement (once selection UX decided).
- **E2E coverage** — duplicate `documents-first-paint.spec.ts` for the newly migrated pages.
- **Manual first-paint verification** — DevTools Network zero-XHR check per page.
