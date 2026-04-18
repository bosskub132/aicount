# Server-Prefetch Tier 1b (Reports + Ledger)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `/ledger` and every page under `/reports/{financial,tax,wht}` to the server-prefetch pattern, so report pages render with data in first paint instead of a skeleton-until-XHR-completes flash.

**Architecture:** Each report page gets: (1) a `<hook>Keys` export on its React Query hook, (2) an inline snapshot contract test, (3) a page split into Server Component shell + `*-client.tsx`, (4) a prefetch wrapped in `HydrationBoundary` in the shell. The DB query functions already exist in `src/lib/db/queries/` — no extraction work.

**Tech Stack:** Next.js 16 App Router, React Query 5, existing Drizzle query functions, Vitest inline snapshots.

**Scope:** Follow-up plan C of four. Depends on Plan A (cleanup). Independent of Plans B and D.

**Reference implementation:** `/documents` pilot (`src/app/(app)/documents/page.tsx`). Every report page in this plan follows the same shape; the per-page tasks below specify the unique hook, query, and default-param values.

---

## Pattern (applied in every page task below)

Each page migration is four sub-steps. Tasks in this plan inline the code for each page-specific variation rather than referring back here — but the shape is:

**A. Keys export** — add to the page's hook file in `src/lib/hooks/`:
```ts
export const <resource>Keys = {
  <query>: (tenantId: string, <params...>) =>
    ["<key-name>", tenantId, <params>] as const,
};
```

**B. Snapshot contract test** — new `use-<resource>.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { <resource>Keys } from "./use-<resource>";

describe("<resource>Keys (contract)", () => {
  it("<query> key stable and agrees between server and client", () => {
    const key = <resource>Keys.<query>(/* sample args */);
    expect(key).toMatchInlineSnapshot(/* populated on first run */);
  });
});
```

**C. Page split** — copy `page.tsx` → `<page>-client.tsx`, rename default export, replace `page.tsx` with a one-liner import + render.

**D. Prefetch shell** — turn `page.tsx` into an async Server Component:
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

  const clientParams = { /* EXACT same shape the client hook uses */ };
  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: <resource>Keys.<query>(tenantId, ...clientParams),
      queryFn: async () => {
        const result = await <queryFn>(tenantId, clientParams);
        return { success: true, data: result };  // match the API envelope
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

**Key invariant:** the `clientParams` object used in the server prefetch must match byte-for-byte the params object the client hook passes to `useQuery` on first render, including `undefined` fields. React Query hashes the key with `JSON.stringify`-style serialization; `{ a: undefined }` ≠ `{}` unless React Query's `hashKey` sorts them the same way (it does since v5, but match anyway for belt-and-suspenders).

---

## Task 0: Pre-flight

- [ ] **Step 1: Plan A must be merged (no zombie query-param fallback)**

```bash
grep -RIn "queryTenantId" src/lib/supabase/middleware.ts 2>/dev/null | wc -l
```

Expected: `0`. If not, land Plan A first.

- [ ] **Step 2: Green baseline**

```bash
npm test -- --run && npm run build
```

---

## Task 1: `/ledger` (General Ledger / Account Ledger)

**Files:**
- Modify: `src/lib/hooks/use-account-ledger.ts` (add `accountLedgerKeys` export + `staleTime`)
- Create: `src/lib/hooks/use-account-ledger.test.ts` (snapshot contract)
- Create: `src/app/(app)/ledger/ledger-client.tsx`
- Modify: `src/app/(app)/ledger/page.tsx`

**Query function:** `src/lib/db/queries/account-ledger.ts` — inspect to find the exported function name and signature.

- [ ] **Step 1 — A: Keys export**

Open `src/lib/hooks/use-account-ledger.ts`. Note the `queryKey` shape in the existing hook (something like `["account-ledger", tenantId, startDate, endDate, accountCode]`). Add the matching `keys` factory to the top of the file:

```ts
export const accountLedgerKeys = {
  detail: (tenantId: string, startDate: string, endDate: string, accountCode: string) =>
    ["account-ledger", tenantId, startDate, endDate, accountCode] as const,
};
```

Replace the hook's inline `queryKey` with `accountLedgerKeys.detail(...)`. Add `staleTime: 60_000`.

- [ ] **Step 2 — B: Snapshot contract test**

Create `src/lib/hooks/use-account-ledger.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { accountLedgerKeys } from "./use-account-ledger";

describe("accountLedgerKeys (contract)", () => {
  it("detail key stable and agrees between server and client", () => {
    const key = accountLedgerKeys.detail(
      "11111111-1111-1111-1111-111111111111",
      "2026-01-01",
      "2026-01-31",
      "1100"
    );
    expect(key).toMatchInlineSnapshot();
  });
});
```

Run `npm test -- --run src/lib/hooks/use-account-ledger.test.ts` — Vitest populates the inline snapshot on first run.

- [ ] **Step 3 — C: Page split**

```bash
cp "src/app/(app)/ledger/page.tsx" "src/app/(app)/ledger/ledger-client.tsx"
```

Rename the default export in `ledger-client.tsx` to `LedgerClient`.

Overwrite `src/app/(app)/ledger/page.tsx`:
```tsx
import LedgerClient from "./ledger-client";
export default function LedgerPage() { return <LedgerClient />; }
```

Build + smoke (identical behavior).

- [ ] **Step 4 — D: Prefetch shell**

Read `ledger-client.tsx` to find the default params the hook uses on first render (usually current month, no account filter). Apply them in the Server Component:

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTenantIdFromRequest } from "@/lib/api/tenant";
import { getAccountLedger } from "@/lib/db/queries/account-ledger";
import { accountLedgerKeys } from "@/lib/hooks/use-account-ledger";
import LedgerClient from "./ledger-client";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default async function LedgerPage() {
  const hdrs = await headers();
  const userId = hdrs.get("x-user-id");
  if (!userId) redirect("/login");
  const tenantId = await getTenantIdFromRequest(userId);
  if (!tenantId) redirect("/dashboard");

  const { start, end } = currentMonthRange();
  const accountCode = "";  // match client initial state

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: accountLedgerKeys.detail(tenantId, start, end, accountCode),
      queryFn: async () => {
        const result = await getAccountLedger(tenantId, { startDate: start, endDate: end, accountCode });
        return { success: true, data: result };
      },
    });
  } catch (error) {
    console.error("[ledger prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LedgerClient />
    </HydrationBoundary>
  );
}
```

Adjust `getAccountLedger(...)` call signature and return-shape handling to match whatever the actual function in `src/lib/db/queries/account-ledger.ts` exports.

Build, run dev, DevTools → Network filter on `account-ledger`, visit `/ledger` — expect zero XHRs during initial render.

- [ ] **Step 5 — Commit**

```bash
git add src/lib/hooks/use-account-ledger.ts src/lib/hooks/use-account-ledger.test.ts "src/app/(app)/ledger"
git commit -m "feat(ledger): server-prefetch general ledger for current month"
```

---

## Task 2: `/reports/financial/trial-balance`

**Files:**
- Modify: `src/lib/hooks/use-trial-balance.ts`
- Create: `src/lib/hooks/use-trial-balance.test.ts`
- Create: `src/app/(app)/reports/financial/trial-balance/trial-balance-client.tsx`
- Modify: `src/app/(app)/reports/financial/trial-balance/page.tsx`

**Query function:** `src/lib/db/queries/*` — check filenames; no dedicated `trial-balance.ts` was listed but there's `balance-sheet.ts`. Trial balance may be computed from `journal-entries.ts` + `master-data.ts`. Grep to confirm.

- [ ] **Step 1: Apply the pattern (A → B → C → D) from the top**

A. Add `trialBalanceKeys` to `use-trial-balance.ts` matching the hook's current `queryKey` shape. Example if current is `["trial-balance", tenantId, asOfDate]`:
```ts
export const trialBalanceKeys = {
  detail: (tenantId: string, asOfDate: string) =>
    ["trial-balance", tenantId, asOfDate] as const,
};
```

B. Create `use-trial-balance.test.ts` mirroring `use-account-ledger.test.ts` structure, with a sample date.

C. Split `page.tsx` → `trial-balance-client.tsx`, rename default export to `TrialBalanceClient`, minimal shell in `page.tsx`.

D. Prefetch shell. Default `asOfDate` = today's date (`new Date().toISOString().slice(0, 10)`). Call the query function from `src/lib/db/queries/` that matches the API route handler for trial balance.

- [ ] **Step 2: Smoke**

Visit `/reports/financial/trial-balance`. DevTools → Network — no XHR to the trial-balance endpoint during initial render.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-trial-balance.ts src/lib/hooks/use-trial-balance.test.ts "src/app/(app)/reports/financial/trial-balance"
git commit -m "feat(reports/trial-balance): server-prefetch report data"
```

---

## Task 3: `/reports/financial/balance-sheet`

**Files:**
- Modify: `src/lib/hooks/use-balance-sheet.ts`
- Create: `src/lib/hooks/use-balance-sheet.test.ts`
- Create: `src/app/(app)/reports/financial/balance-sheet/balance-sheet-client.tsx`
- Modify: `src/app/(app)/reports/financial/balance-sheet/page.tsx`
- Query in: `src/lib/db/queries/balance-sheet.ts`

- [ ] **Step 1: Apply the pattern**

A. `balanceSheetKeys` export on `use-balance-sheet.ts`. Match current `queryKey` exactly (likely `["balance-sheet", tenantId, asOfDate]`).

B. Snapshot test `use-balance-sheet.test.ts`.

C. Page split.

D. Prefetch shell calling the query from `src/lib/db/queries/balance-sheet.ts`. Default period = current fiscal month/year; check client to match.

- [ ] **Step 2: Smoke + commit**

Verify first-paint, commit:
```bash
git add src/lib/hooks/use-balance-sheet.ts src/lib/hooks/use-balance-sheet.test.ts "src/app/(app)/reports/financial/balance-sheet"
git commit -m "feat(reports/balance-sheet): server-prefetch report data"
```

---

## Task 4: `/reports/financial/profit-loss`

**Files:**
- Modify: `src/lib/hooks/use-profit-loss.ts`
- Create: `src/lib/hooks/use-profit-loss.test.ts`
- Create: `src/app/(app)/reports/financial/profit-loss/profit-loss-client.tsx`
- Modify: `src/app/(app)/reports/financial/profit-loss/page.tsx`
- Query in: `src/lib/db/queries/profit-loss.ts`

- [ ] **Step 1: Apply the pattern**

A. `profitLossKeys` export. Match current `queryKey` — typically `["profit-loss", tenantId, startDate, endDate]`.

B. Snapshot test.

C. Page split.

D. Prefetch shell. Default date range = current month.

- [ ] **Step 2: Smoke + commit**

```bash
git add src/lib/hooks/use-profit-loss.ts src/lib/hooks/use-profit-loss.test.ts "src/app/(app)/reports/financial/profit-loss"
git commit -m "feat(reports/profit-loss): server-prefetch report data"
```

---

## Task 5: `/reports/financial/cash-flow`

**Files:**
- Modify: `src/lib/hooks/use-cash-flow.ts`
- Create: `src/lib/hooks/use-cash-flow.test.ts`
- Create: `src/app/(app)/reports/financial/cash-flow/cash-flow-client.tsx`
- Modify: `src/app/(app)/reports/financial/cash-flow/page.tsx`
- Query in: `src/lib/db/queries/cash-flow.ts`

- [ ] **Step 1: Apply the pattern**

A. `cashFlowKeys`.
B. Snapshot test.
C. Page split.
D. Prefetch shell — default date range is current month.

- [ ] **Step 2: Smoke + commit**

```bash
git add src/lib/hooks/use-cash-flow.ts src/lib/hooks/use-cash-flow.test.ts "src/app/(app)/reports/financial/cash-flow"
git commit -m "feat(reports/cash-flow): server-prefetch report data"
```

---

## Task 6: `/reports/financial/gl-detail`

**Files:**
- Modify: `src/lib/hooks/use-gl-detail.ts`
- Create: `src/lib/hooks/use-gl-detail.test.ts`
- Create: `src/app/(app)/reports/financial/gl-detail/gl-detail-client.tsx`
- Modify: `src/app/(app)/reports/financial/gl-detail/page.tsx`
- Query in: `src/lib/db/queries/account-ledger.ts` (gl-detail typically uses the same ledger query under the hood — verify)

- [ ] **Step 1: Apply the pattern**

A. `glDetailKeys`.
B. Snapshot.
C. Split.
D. Prefetch.

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-gl-detail.ts src/lib/hooks/use-gl-detail.test.ts "src/app/(app)/reports/financial/gl-detail"
git commit -m "feat(reports/gl-detail): server-prefetch report data"
```

---

## Task 7: `/reports/financial/journal-listing`

**Files:**
- Modify: `src/lib/hooks/use-journal-listing.ts`
- Create: `src/lib/hooks/use-journal-listing.test.ts`
- Create: `src/app/(app)/reports/financial/journal-listing/journal-listing-client.tsx`
- Modify: `src/app/(app)/reports/financial/journal-listing/page.tsx`
- Query in: `src/lib/db/queries/journal-listing.ts`

- [ ] Apply pattern + commit.

```bash
git add src/lib/hooks/use-journal-listing.ts src/lib/hooks/use-journal-listing.test.ts "src/app/(app)/reports/financial/journal-listing"
git commit -m "feat(reports/journal-listing): server-prefetch report data"
```

---

## Task 8: `/reports/financial/monthly-comparison`

**Files:**
- Modify: `src/lib/hooks/use-monthly-comparison.ts`
- Create: `src/lib/hooks/use-monthly-comparison.test.ts`
- Create: `src/app/(app)/reports/financial/monthly-comparison/monthly-comparison-client.tsx`
- Modify: `src/app/(app)/reports/financial/monthly-comparison/page.tsx`

Note: dashboard already prefetches `monthlyComparison` via `dashboardKeys.monthlyComparison`. If the `/reports/financial/monthly-comparison` page uses the same hook, re-use `dashboardKeys` in Server Component instead of creating a new keys export. Otherwise create a dedicated `monthlyComparisonKeys`.

- [ ] Apply pattern + commit.

```bash
git add src/lib/hooks/use-monthly-comparison.ts src/lib/hooks/use-monthly-comparison.test.ts "src/app/(app)/reports/financial/monthly-comparison"
git commit -m "feat(reports/monthly-comparison): server-prefetch report data"
```

---

## Task 9: Tax reports — `/reports/tax/pnd3`, `pnd53`, `pp30`, `pp36`, `purchase-vat`, `sales-vat`

**Files (per page — repeat for each of the six):**
- Modify: `src/lib/hooks/use-tax-<type>.ts` (e.g. `use-tax-pnd3.ts`)
- Create: `src/lib/hooks/use-tax-<type>.test.ts`
- Create: `src/app/(app)/reports/tax/<type>/<type>-client.tsx`
- Modify: `src/app/(app)/reports/tax/<type>/page.tsx`
- Query in: `src/lib/db/queries/tax-<type>.ts` or `src/lib/db/queries/vat-register.ts` (for purchase-vat / sales-vat)

Tax reports are always **monthly** (per `CLAUDE.md` rule). Default period = current month year+month (YYYY-MM).

- [ ] **Step 1: `pnd3`** — apply pattern. Hook → keys + snapshot → split → prefetch. Commit:
  ```bash
  git add src/lib/hooks/use-tax-pnd3.ts src/lib/hooks/use-tax-pnd3.test.ts "src/app/(app)/reports/tax/pnd3"
  git commit -m "feat(reports/pnd3): server-prefetch report data"
  ```

- [ ] **Step 2: `pnd53`** — same. Commit:
  ```bash
  git add src/lib/hooks/use-tax-pnd53.ts src/lib/hooks/use-tax-pnd53.test.ts "src/app/(app)/reports/tax/pnd53"
  git commit -m "feat(reports/pnd53): server-prefetch report data"
  ```

- [ ] **Step 3: `pp30`** — same. Commit:
  ```bash
  git add src/lib/hooks/use-tax-pp30.ts src/lib/hooks/use-tax-pp30.test.ts "src/app/(app)/reports/tax/pp30"
  git commit -m "feat(reports/pp30): server-prefetch report data"
  ```

- [ ] **Step 4: `pp36`** — same. Commit:
  ```bash
  git add src/lib/hooks/use-tax-pp36.ts src/lib/hooks/use-tax-pp36.test.ts "src/app/(app)/reports/tax/pp36"
  git commit -m "feat(reports/pp36): server-prefetch report data"
  ```

- [ ] **Step 5: `purchase-vat`** — uses `use-vat-register.ts`. Add `vatRegisterKeys` with a `direction: "purchase" | "sales"` discriminator:
  ```ts
  export const vatRegisterKeys = {
    list: (tenantId: string, direction: "purchase" | "sales", yyyyMM: string) =>
      ["vat-register", tenantId, direction, yyyyMM] as const,
  };
  ```
  Split + prefetch with `direction: "purchase"`. Commit:
  ```bash
  git add src/lib/hooks/use-vat-register.ts src/lib/hooks/use-vat-register.test.ts "src/app/(app)/reports/tax/purchase-vat"
  git commit -m "feat(reports/purchase-vat): server-prefetch report data"
  ```

- [ ] **Step 6: `sales-vat`** — re-use `vatRegisterKeys` with `direction: "sales"`. Split + prefetch. Commit:
  ```bash
  git add "src/app/(app)/reports/tax/sales-vat"
  git commit -m "feat(reports/sales-vat): server-prefetch report data"
  ```

---

## Task 10: `/reports/wht` (WHT Certificates)

**Files:**
- Modify: `src/lib/hooks/use-wht-certificates.ts`
- Create: `src/lib/hooks/use-wht-certificates.test.ts`
- Create: `src/app/(app)/reports/wht/wht-client.tsx`
- Modify: `src/app/(app)/reports/wht/page.tsx`
- Query in: `src/lib/db/queries/wht-certificates.ts`

- [ ] **Step 1: Apply the pattern**

A. `whtCertificatesKeys`.
B. Snapshot test.
C. Page split.
D. Prefetch with default period = current month.

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-wht-certificates.ts src/lib/hooks/use-wht-certificates.test.ts "src/app/(app)/reports/wht"
git commit -m "feat(reports/wht): server-prefetch wht certificates"
```

---

## Task 11: Regression + spot-check E2E

- [ ] **Step 1: Full test suite**

```bash
npm test -- --run
```

Expected: baseline + 10+ new snapshot tests (one per hook touched in this plan), all passing.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Manual first-paint smoke on a representative subset**

Run `npm run dev`. DevTools → Network filter to each relevant endpoint. Visit:
- `/ledger`
- `/reports/financial/trial-balance`
- `/reports/financial/profit-loss`
- `/reports/tax/pnd3`
- `/reports/wht`

Each should render the table with data in first paint; zero XHRs to the primary endpoint during initial render.

If any page shows an empty-state or a loading skeleton briefly, inspect the React Query devtools for a key mismatch between the server prefetch and the client `useQuery`.

---

## Notes

- **Report pages with date-range filters:** the client usually initializes the filter to "current month" via `useState(() => currentMonthRange())` or similar. The server prefetch must compute the SAME range — don't rely on midnight edge cases (server might be on UTC; client on Bangkok time). Use a deterministic formula in a shared util if needed.
- **Bigint columns:** `CLAUDE.md` flags hydration mismatches from bigint counts. The query functions already normalize; if you extract a new path, match the pattern in `src/lib/db/queries/documents.ts` (Number() / toIso()).
- **Error boundary:** prefetch failures log to `console.error` and fall through. The client's `useQuery` will re-fetch on mount — worst case, today's behavior.
- **Sort order matters for `HydrationBoundary`:** React Query ≥5.90 supports prefetching arbitrary queries; no special sort order required.
