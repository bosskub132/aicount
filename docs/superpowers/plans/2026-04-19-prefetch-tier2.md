# Server-Prefetch Tier 2 (Master Data / AR+AP / Bank Recon)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate master-data settings pages (COA / Vendors / Customers / Departments / Products), Accounts Receivable & Payable lists, and Bank Reconciliation pages to the server-prefetch pattern — rounds out the full Tier 1/2 page coverage described in the design spec.

**Architecture:** Same pattern as Plan B (pilot) and Plan C (reports): page split into Server Component shell + `*-client.tsx`, `HydrationBoundary` wrapping prefetched data keyed off a `<resource>Keys` export from the hook file. DB query functions already exist in `src/lib/db/queries/` — no extraction.

**Tech Stack:** Next.js 16 App Router, React Query 5, existing Drizzle query functions, Vitest inline snapshots.

**Scope:** Follow-up plan D of four. Depends on Plan A (cleanup). Independent of Plans B and C.

**Reference implementation:** `/documents` pilot (`src/app/(app)/documents/page.tsx`). Every page in this plan follows the same shape; per-page tasks below specify the hook, query, and default-param values.

---

## Pattern

Each page migration has four sub-steps — same as Plans B and C:

**A. Keys export** — add `<resource>Keys` factory to the page's hook file.

**B. Snapshot contract test** — new `use-<resource>.test.ts` with `toMatchInlineSnapshot()`.

**C. Page split** — `cp page.tsx <page>-client.tsx`, rename default export, replace `page.tsx` with one-liner.

**D. Prefetch shell** — async Server Component that resolves tenant via cookie, calls the DB query, wraps client body in `HydrationBoundary`.

The shell template (copy for each page, fill in the variables):

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { <queryFn> } from "@/lib/db/queries/<file>";
import { <resource>Keys } from "@/lib/hooks/use-<resource>";
import <Page>Client from "./<page>-client";

export default async function <Page>Page() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");
  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) redirect("/dashboard");

  const clientParams = { /* EXACT first-render params from client */ };
  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: <resource>Keys.<query>(tenantId, <params>),
      queryFn: async () => {
        const result = await <queryFn>(tenantId, clientParams);
        return { success: true, data: result };  // match API envelope
      },
    });
  } catch (error) {
    console.error("[<page> prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <<Page>Client />
    </HydrationBoundary>
  );
}
```

**Invariant:** `clientParams` in the server prefetch must match byte-for-byte the params the client hook passes on first render (including `undefined` fields). Check the snapshot test output against the client's actual first render if the first-paint network check still fires an XHR.

---

## Task 0: Pre-flight

- [ ] **Step 1: Confirm Plan A is merged**

```bash
grep -RIn "queryTenantId" src/lib/supabase/middleware.ts 2>/dev/null | wc -l
```

Expected: `0`.

- [ ] **Step 2: Green baseline**

```bash
npm test -- --run && npm run build
```

---

## Task 1: `/settings/masterdata/coa`

**Files:**
- Modify: `src/lib/hooks/` — find which hook the page uses (likely none; the page may fetch directly). If no hook, skip to step C below and embed fetch directly in Server Component.
- Create: `src/lib/hooks/use-coa.ts` + `.test.ts` if no existing hook (see step A below).
- Create: `src/app/(app)/settings/masterdata/coa/coa-client.tsx`
- Modify: `src/app/(app)/settings/masterdata/coa/page.tsx`
- Query in: `src/lib/db/queries/master-data.ts` — look for a function like `listCoa` or `listChartOfAccounts`.

- [ ] **Step 1 — A: Keys + hook (if missing)**

Grep the page to see what it fetches:
```bash
grep -n "fetch.*api/tenants" "src/app/(app)/settings/masterdata/coa/page.tsx"
```

If the page fetches `/api/tenants/${tenantId}/coa` directly via inline `useEffect` + `fetch`, there's no React Query hook yet. Add one:

Create `src/lib/hooks/use-coa.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export type CoaRow = {
  accountCode: string;
  accountName: string;
  category: string;
  cashFlowCategory?: string | null;
};

export const coaKeys = {
  list: (tenantId: string) => ["coa", tenantId] as const,
};

export function useCoa() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: coaKeys.list(tenantId),
    queryFn: async (): Promise<CoaRow[]> => {
      const res = await fetch(`/api/tenants/${tenantId}/coa`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60_000,  // COA rarely changes
  });
}
```

Refactor `page.tsx`'s inline fetch to call `useCoa()` instead.

If a hook already exists, just add `coaKeys` following the pattern from Plan B Task 1.

- [ ] **Step 2 — B: Snapshot contract test**

Create `src/lib/hooks/use-coa.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { coaKeys } from "./use-coa";

describe("coaKeys (contract)", () => {
  it("list key stable", () => {
    const key = coaKeys.list("11111111-1111-1111-1111-111111111111");
    expect(key).toMatchInlineSnapshot(`
      [
        "coa",
        "11111111-1111-1111-1111-111111111111",
      ]
    `);
  });
});
```

- [ ] **Step 3 — C: Page split**

```bash
cp "src/app/(app)/settings/masterdata/coa/page.tsx" "src/app/(app)/settings/masterdata/coa/coa-client.tsx"
```

Rename default export to `CoaClient`. Minimal shell in `page.tsx`:
```tsx
import CoaClient from "./coa-client";
export default function CoaPage() { return <CoaClient />; }
```

Build + smoke.

- [ ] **Step 4 — D: Prefetch shell**

Overwrite `src/app/(app)/settings/masterdata/coa/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { listCoa } from "@/lib/db/queries/master-data";
import { coaKeys } from "@/lib/hooks/use-coa";
import CoaClient from "./coa-client";

export default async function CoaPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");
  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) redirect("/dashboard");

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: coaKeys.list(tenantId),
      queryFn: async () => {
        const rows = await listCoa(tenantId);
        return { success: true, data: rows };
      },
    });
  } catch (error) {
    console.error("[coa prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CoaClient />
    </HydrationBoundary>
  );
}
```

Adjust `listCoa(tenantId)` call signature to match what `master-data.ts` actually exports.

- [ ] **Step 5: Smoke**

Run `npm run dev`. DevTools → Network filter on `coa`. Visit `/settings/masterdata/coa` — zero XHRs to `/api/tenants/*/coa` during initial render; rows in first paint.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/use-coa.ts src/lib/hooks/use-coa.test.ts "src/app/(app)/settings/masterdata/coa"
git commit -m "feat(masterdata/coa): server-prefetch chart of accounts"
```

---

## Task 2: `/settings/masterdata/vendors`

**Files:**
- Hook: `src/lib/hooks/use-vendors.ts` (create if missing, following Task 1 A pattern)
- Test: `src/lib/hooks/use-vendors.test.ts`
- Client body: `src/app/(app)/settings/masterdata/vendors/vendors-client.tsx`
- Server shell: `src/app/(app)/settings/masterdata/vendors/page.tsx`
- Query in: `src/lib/db/queries/master-data.ts` (look for `listVendors`)

- [ ] **Step 1: Apply A/B/C/D from pattern**

A. `vendorsKeys` in `use-vendors.ts`. Include pagination/search params if the page uses them:
```ts
export interface VendorsParams {
  page?: number;
  limit?: number;
  search?: string;
}
export const vendorsKeys = {
  list: (tenantId: string, params: VendorsParams) =>
    ["vendors", tenantId, params] as const,
};
```

B. Snapshot test mirroring Task 1 Step 2.

C. Split page.

D. Prefetch shell with default `{ page: 1, limit: 50, search: undefined }` (confirm against the client).

- [ ] **Step 2: Smoke + commit**

```bash
git add src/lib/hooks/use-vendors.ts src/lib/hooks/use-vendors.test.ts "src/app/(app)/settings/masterdata/vendors"
git commit -m "feat(masterdata/vendors): server-prefetch vendor list"
```

---

## Task 3: `/settings/masterdata/customers`

**Files:**
- Hook: `src/lib/hooks/use-customers.ts`
- Test: `src/lib/hooks/use-customers.test.ts`
- Client: `src/app/(app)/settings/masterdata/customers/customers-client.tsx`
- Server: `src/app/(app)/settings/masterdata/customers/page.tsx`
- Query: `src/lib/db/queries/master-data.ts` — `listCustomers`

- [ ] **Step 1: Apply pattern (same as vendors, swap "customer" for "vendor")**

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-customers.ts src/lib/hooks/use-customers.test.ts "src/app/(app)/settings/masterdata/customers"
git commit -m "feat(masterdata/customers): server-prefetch customer list"
```

---

## Task 4: `/settings/masterdata/departments`

**Files:**
- Hook: `src/lib/hooks/use-departments.ts`
- Test: `src/lib/hooks/use-departments.test.ts`
- Client: `src/app/(app)/settings/masterdata/departments/departments-client.tsx`
- Server: `src/app/(app)/settings/masterdata/departments/page.tsx`
- Query: `src/lib/db/queries/master-data.ts` — `listDepartments`

Departments are small (typically <50 rows). Prefetch the entire list — no pagination needed.

```ts
export const departmentsKeys = {
  list: (tenantId: string) => ["departments", tenantId] as const,
};
```

- [ ] **Step 1: Apply pattern**

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-departments.ts src/lib/hooks/use-departments.test.ts "src/app/(app)/settings/masterdata/departments"
git commit -m "feat(masterdata/departments): server-prefetch department list"
```

---

## Task 5: `/settings/masterdata/products`

**Files:**
- Hook: `src/lib/hooks/use-products.ts`
- Test: `src/lib/hooks/use-products.test.ts`
- Client: `src/app/(app)/settings/masterdata/products/products-client.tsx`
- Server: `src/app/(app)/settings/masterdata/products/page.tsx`
- Query: `src/lib/db/queries/master-data.ts` — `listProducts`

- [ ] **Step 1: Apply pattern**

Structure mirrors `vendors` — with pagination/search. Keys:
```ts
export interface ProductsParams {
  page?: number;
  limit?: number;
  search?: string;
}
export const productsKeys = {
  list: (tenantId: string, params: ProductsParams) =>
    ["products", tenantId, params] as const,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-products.ts src/lib/hooks/use-products.test.ts "src/app/(app)/settings/masterdata/products"
git commit -m "feat(masterdata/products): server-prefetch product list"
```

---

## Task 6: `/payables` (Accounts Payable)

**Files:**
- Modify: `src/lib/hooks/use-payables.ts` (add `payablesKeys`)
- Create: `src/lib/hooks/use-payables.test.ts`
- Create: `src/app/(app)/payables/payables-client.tsx`
- Modify: `src/app/(app)/payables/page.tsx`
- Query in: `src/lib/db/queries/payables.ts`

AR/AP aging lists benefit from prefetch — large tables with joins.

- [ ] **Step 1: Apply pattern**

A. `payablesKeys` — match the hook's `queryKey`. Likely `["payables", tenantId, asOfDate]`:
```ts
export const payablesKeys = {
  aging: (tenantId: string, asOfDate: string) =>
    ["payables", tenantId, asOfDate] as const,
};
```

B. Snapshot test.

C. Page split.

D. Prefetch shell with `asOfDate = today`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-payables.ts src/lib/hooks/use-payables.test.ts "src/app/(app)/payables"
git commit -m "feat(payables): server-prefetch AP aging"
```

---

## Task 7: `/receivables` (Accounts Receivable)

**Files:**
- Modify: `src/lib/hooks/use-receivables.ts`
- Create: `src/lib/hooks/use-receivables.test.ts`
- Create: `src/app/(app)/receivables/receivables-client.tsx`
- Modify: `src/app/(app)/receivables/page.tsx`
- Query in: `src/lib/db/queries/receivables.ts`

- [ ] **Step 1: Apply pattern**

A. `receivablesKeys.aging(tenantId, asOfDate)`.
B. Snapshot test.
C. Page split.
D. Prefetch with today's date.

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-receivables.ts src/lib/hooks/use-receivables.test.ts "src/app/(app)/receivables"
git commit -m "feat(receivables): server-prefetch AR aging"
```

---

## Task 8: `/bank-recon`

**Files:**
- Modify: `src/lib/hooks/use-bank-recon.ts` (+ possibly `use-bank-recon-statements.ts`)
- Create: `src/lib/hooks/use-bank-recon.test.ts`
- Create: `src/app/(app)/bank-recon/bank-recon-client.tsx`
- Modify: `src/app/(app)/bank-recon/page.tsx`
- Query in: `src/lib/db/queries/bank-recon.ts`

- [ ] **Step 1: Apply pattern**

The bank-recon page likely uses two hooks: one for the transactions list, one for the recon status. Prefetch the transactions list only (largest content). Secondary hook fires client-side.

A. `bankReconKeys.transactions(tenantId, accountId, period)` matching the hook's current shape.

B. Snapshot.

C. Page split.

D. Prefetch default = first available bank account + current month. If no account is pre-selected, skip prefetch (the client will show an account picker).

Include a check in the Server Component:
```tsx
if (!defaultAccountId) {
  // no account selected — let client render the picker
  return <BankReconClient />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-bank-recon.ts src/lib/hooks/use-bank-recon.test.ts "src/app/(app)/bank-recon"
git commit -m "feat(bank-recon): server-prefetch reconciliation transactions"
```

---

## Task 9: `/settings/accounting/bank-recon`

**Files:**
- Probably NO React Query hook — this page is configuration (account rules). It might just be a form.
- Check: `grep -n "useQuery\|useBank" "src/app/(app)/settings/accounting/bank-recon/page.tsx"`

- [ ] **Step 1: Assess whether prefetch is worth it**

If the page renders a form of config settings (not a data table), it has no data to prefetch meaningfully. **Skip this task** and record:

> `/settings/accounting/bank-recon` does not benefit from server prefetch (config form, no primary list query). Left as-is.

If there IS a list query (e.g., bank reconciliation rules table), apply the full pattern as in Task 8.

- [ ] **Step 2: Commit only if changes were made**

---

## Task 10: Regression + representative E2E smoke

- [ ] **Step 1: Full test suite**

```bash
npm test -- --run
```

Expected: baseline + 9 new snapshot tests (one per hook touched), all passing.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Manual first-paint smoke**

Run `npm run dev`. For each page, DevTools → Network filter on its primary endpoint, visit the page, confirm zero XHRs during initial render:
- `/settings/masterdata/coa`
- `/settings/masterdata/vendors`
- `/settings/masterdata/customers`
- `/settings/masterdata/departments`
- `/settings/masterdata/products`
- `/payables`
- `/receivables`
- `/bank-recon`

Any page where an XHR fires during initial render indicates a key mismatch. Inspect React Query devtools for the computed key on server vs client and align the `clientParams` in the Server Component.

---

## Notes

- **Master data volumes:** for any list that can exceed ~500 rows, paginate the prefetch (page 1, limit 100). The list is then "first page already hydrated; subsequent pages fetch client-side". Don't prefetch unbounded lists.
- **Forms without lists:** `/settings/workspace/general`, `/settings/workspace/members`, etc. are included in the codebase but are NOT migration candidates — they're config forms, not data lists. The cleanup in Plan A already swept their `localStorage` and header usage.
- **Closing the spec:** once Plans A + B + C + D land, the only remaining page-spec work is the optional `/settings/accounting/bank-recon` from Task 9. Update `docs/superpowers/specs/2026-04-18-ui-responsiveness-server-prefetch-design.md` with a "Completed" section listing the migrated pages.
