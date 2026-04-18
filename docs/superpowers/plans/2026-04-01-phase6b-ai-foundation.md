# Phase 6B: AI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI usage tracking, tenant budget controls, a superadmin backoffice with analytics dashboard and extraction rule management.

**Architecture:** New `ai_usage_logs` table captures every AI API call. Extraction pipeline writes usage rows after each tier. `profiles.isSuperadmin` boolean gates a new `/backoffice` route group with its own layout and sidebar. Tenant admins see a simple usage widget in Settings; superadmins see cross-tenant analytics.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Supabase, React Query, Recharts, Tailwind CSS v4, Lucide React

**Spec:** `docs/superpowers/specs/2026-04-01-phase6b-ai-foundation-design.md`

---

## File Structure

### New Files

```
src/lib/db/queries/ai-usage.ts                          — Usage aggregation queries (tenant + backoffice)
src/lib/hooks/use-ai-usage.ts                            — React Query hook for tenant AI usage
src/lib/hooks/use-backoffice.ts                          — React Query hooks for backoffice data
src/lib/services/extraction/usage-logger.ts              — Write ai_usage_logs rows (called from pipeline)
src/components/backoffice-sidebar.tsx                     — Backoffice navigation sidebar
src/components/budget-progress-bar.tsx                    — Reusable budget bar (settings + backoffice)
src/components/tier-distribution-chart.tsx                — Donut chart for tier breakdown
src/components/daily-cost-chart.tsx                       — Line chart for daily cost trend
src/app/api/settings/ai-usage/route.ts                   — Tenant's own AI usage API
src/app/api/backoffice/analytics/route.ts                — Overview analytics API
src/app/api/backoffice/analytics/tenants/route.ts        — Per-tenant usage API
src/app/api/backoffice/rules/route.ts                    — Rules list API
src/app/api/backoffice/rules/[id]/route.ts               — Rule update/delete API
src/app/api/backoffice/tenants/route.ts                  — Tenant list API
src/app/(backoffice)/layout.tsx                          — Backoffice shell + superadmin guard
src/app/(backoffice)/backoffice/page.tsx                 — Redirect to overview
src/app/(backoffice)/backoffice/overview/page.tsx        — AI Overview dashboard
src/app/(backoffice)/backoffice/rules/page.tsx           — Extraction Rules management
src/app/(backoffice)/backoffice/tenants/page.tsx         — Tenant list
src/app/(app)/settings/accounting/ai-usage/page.tsx      — Tenant AI Usage widget
```

### Modified Files

```
src/lib/db/schema.ts                                     — ADD: aiUsageLogs table, profiles.isSuperadmin, tenants budget columns
src/lib/supabase/middleware.ts                           — ADD: query profiles.is_superadmin, set x-is-superadmin header
src/lib/api/request-context.ts                           — ADD: isSuperadmin to RequestContext type + getRequestContext
src/lib/services/extraction/pipeline.ts                  — ADD: call logUsage() after buildResult
src/app/(app)/settings/layout.tsx                        — ADD: "AI Usage" nav item under ACCOUNTING group
src/components/sidebar.tsx                               — ADD: conditional "Backoffice" link for superadmins
```

---

## Task 1: Database Schema — ai_usage_logs + Column Additions

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add aiUsageLogs table definition to schema.ts**

Add after the `aiExtractionRules` table definition (around line 860):

```typescript
export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    documentId: uuid("document_id").references(() => documents.id),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    feature: text("feature").notNull().default("extraction"),
    tier: integer("tier"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: decimal("cost_usd", { precision: 10, scale: 6 })
      .notNull()
      .default("0"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_ai_usage_logs_tenant_date").on(table.tenantId, table.createdAt),
    index("idx_ai_usage_logs_feature_date").on(table.feature, table.createdAt),
  ]
);
```

- [ ] **Step 2: Add isSuperadmin column to profiles table**

Find the `profiles` table definition in schema.ts and add:

```typescript
isSuperadmin: boolean("is_superadmin").notNull().default(false),
```

- [ ] **Step 3: Add budget columns to tenants table**

Find the `tenants` table definition in schema.ts and add:

```typescript
monthlyBudgetUsd: decimal("monthly_budget_usd", { precision: 10, scale: 2 }),
budgetAlertThreshold: decimal("budget_alert_threshold", { precision: 3, scale: 2 }).default("0.80"),
```

- [ ] **Step 4: Generate Drizzle migration**

Run: `npx drizzle-kit generate`

Expected: New migration file created in `supabase/migrations/` with CREATE TABLE and ALTER TABLE statements.

- [ ] **Step 5: Verify migration SQL looks correct**

Read the generated migration file and verify:
- `ai_usage_logs` table with all columns and indexes
- `profiles.is_superadmin` column with default false
- `tenants.monthly_budget_usd` and `budget_alert_threshold` columns

- [ ] **Step 6: Apply migration**

Run: `npx drizzle-kit push`

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts supabase/migrations/
git commit -m "feat: add ai_usage_logs table, superadmin flag, and budget columns"
```

---

## Task 2: Usage Logger Service

**Files:**
- Create: `src/lib/services/extraction/usage-logger.ts`
- Create: `src/lib/db/queries/ai-usage.ts`

- [ ] **Step 1: Create usage logger service**

```typescript
// src/lib/services/extraction/usage-logger.ts
import { db } from "@/lib/db";
import { aiUsageLogs } from "@/lib/db/schema";

interface LogUsageParams {
  tenantId: string;
  documentId: string;
  provider: "anthropic" | "google";
  model: string;
  feature?: string;
  tier?: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  metadata?: Record<string, unknown> | null;
}

export async function logAiUsage(params: LogUsageParams): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      tenantId: params.tenantId,
      documentId: params.documentId,
      provider: params.provider,
      model: params.model,
      feature: params.feature ?? "extraction",
      tier: params.tier ?? null,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd: params.costUsd.toFixed(6),
      metadata: params.metadata ?? null,
    });
  } catch (error: unknown) {
    // Non-blocking: log error but don't fail the extraction
    // eslint-disable-next-line no-console
    console.error(
      "[usage-logger] Failed to log AI usage:",
      error instanceof Error ? error.message : error
    );
  }
}
```

- [ ] **Step 2: Create AI usage queries file**

```typescript
// src/lib/db/queries/ai-usage.ts
import { and, eq, gte, lt, sql, count, sum, countDistinct, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsageLogs, tenants } from "@/lib/db/schema";

interface MonthRange {
  start: Date;
  end: Date;
}

function getMonthRange(year: number, month: number): MonthRange {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export interface TenantUsageSummary {
  documentCount: number;
  totalCostUsd: number;
  avgCostPerDoc: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
}

export async function getTenantUsageSummary(
  tenantId: string,
  year: number,
  month: number
): Promise<TenantUsageSummary> {
  const { start, end } = getMonthRange(year, month);

  const [result] = await db
    .select({
      documentCount: countDistinct(aiUsageLogs.documentId),
      totalCostUsd: sum(aiUsageLogs.costUsd),
      tier1Count: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 1)`,
      tier2Count: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 2)`,
      tier3Count: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 3)`,
    })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.tenantId, tenantId),
        eq(aiUsageLogs.feature, "extraction"),
        gte(aiUsageLogs.createdAt, start),
        lt(aiUsageLogs.createdAt, end)
      )
    );

  const totalCost = Number(result?.totalCostUsd ?? 0);
  const docCount = Number(result?.documentCount ?? 0);

  return {
    documentCount: docCount,
    totalCostUsd: totalCost,
    avgCostPerDoc: docCount > 0 ? totalCost / docCount : 0,
    tier1Count: Number(result?.tier1Count ?? 0),
    tier2Count: Number(result?.tier2Count ?? 0),
    tier3Count: Number(result?.tier3Count ?? 0),
  };
}

export interface PlatformOverview {
  totalCostUsd: number;
  totalDocuments: number;
  activeTenants: number;
  avgCostPerDoc: number;
}

export async function getPlatformOverview(
  year: number,
  month: number
): Promise<PlatformOverview> {
  const { start, end } = getMonthRange(year, month);

  const [result] = await db
    .select({
      totalCostUsd: sum(aiUsageLogs.costUsd),
      totalDocuments: countDistinct(aiUsageLogs.documentId),
      activeTenants: countDistinct(aiUsageLogs.tenantId),
    })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.feature, "extraction"),
        gte(aiUsageLogs.createdAt, start),
        lt(aiUsageLogs.createdAt, end)
      )
    );

  const totalCost = Number(result?.totalCostUsd ?? 0);
  const totalDocs = Number(result?.totalDocuments ?? 0);

  return {
    totalCostUsd: totalCost,
    totalDocuments: totalDocs,
    activeTenants: Number(result?.activeTenants ?? 0),
    avgCostPerDoc: totalDocs > 0 ? totalCost / totalDocs : 0,
  };
}

export interface DailyCostPoint {
  date: string;
  dailyCost: number;
  cumulativeCost: number;
}

export async function getDailyCosts(
  year: number,
  month: number
): Promise<DailyCostPoint[]> {
  const { start, end } = getMonthRange(year, month);

  const rows = await db
    .select({
      date: sql<string>`DATE(${aiUsageLogs.createdAt})`,
      dailyCost: sum(aiUsageLogs.costUsd),
    })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.feature, "extraction"),
        gte(aiUsageLogs.createdAt, start),
        lt(aiUsageLogs.createdAt, end)
      )
    )
    .groupBy(sql`DATE(${aiUsageLogs.createdAt})`)
    .orderBy(sql`DATE(${aiUsageLogs.createdAt})`);

  let cumulative = 0;
  return rows.map((row) => {
    const daily = Number(row.dailyCost ?? 0);
    cumulative += daily;
    return {
      date: String(row.date),
      dailyCost: daily,
      cumulativeCost: cumulative,
    };
  });
}

export interface TenantUsageRow {
  tenantId: string;
  tenantName: string;
  documentCount: number;
  totalCostUsd: number;
  avgCostPerDoc: number;
  tier1Pct: number;
  monthlyBudgetUsd: number | null;
  budgetUsedPct: number | null;
}

export async function getPerTenantUsage(
  year: number,
  month: number,
  search?: string,
  page = 1,
  limit = 20
): Promise<{ rows: TenantUsageRow[]; total: number }> {
  const { start, end } = getMonthRange(year, month);
  const offset = (page - 1) * limit;

  // Build base query with join
  const baseWhere = and(
    eq(aiUsageLogs.feature, "extraction"),
    gte(aiUsageLogs.createdAt, start),
    lt(aiUsageLogs.createdAt, end),
    search
      ? sql`${tenants.name} ILIKE ${"%" + search + "%"}`
      : undefined
  );

  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      monthlyBudgetUsd: tenants.monthlyBudgetUsd,
      documentCount: countDistinct(aiUsageLogs.documentId),
      totalCostUsd: sum(aiUsageLogs.costUsd),
      totalCalls: count(),
      tier1Count: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 1)`,
    })
    .from(aiUsageLogs)
    .innerJoin(tenants, eq(aiUsageLogs.tenantId, tenants.id))
    .where(baseWhere)
    .groupBy(tenants.id, tenants.name, tenants.monthlyBudgetUsd)
    .orderBy(desc(sum(aiUsageLogs.costUsd)))
    .limit(limit)
    .offset(offset);

  // Count total distinct tenants for pagination
  const [countResult] = await db
    .select({ total: countDistinct(aiUsageLogs.tenantId) })
    .from(aiUsageLogs)
    .innerJoin(tenants, eq(aiUsageLogs.tenantId, tenants.id))
    .where(baseWhere);

  const mapped: TenantUsageRow[] = rows.map((r) => {
    const cost = Number(r.totalCostUsd ?? 0);
    const docs = Number(r.documentCount ?? 0);
    const totalCalls = Number(r.totalCalls ?? 0);
    const tier1 = Number(r.tier1Count ?? 0);
    const budget = r.monthlyBudgetUsd ? Number(r.monthlyBudgetUsd) : null;

    return {
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      documentCount: docs,
      totalCostUsd: cost,
      avgCostPerDoc: docs > 0 ? cost / docs : 0,
      tier1Pct: totalCalls > 0 ? Math.round((tier1 / totalCalls) * 100) : 0,
      monthlyBudgetUsd: budget,
      budgetUsedPct: budget ? Math.round((cost / budget) * 100) : null,
    };
  });

  return { rows: mapped, total: Number(countResult?.total ?? 0) };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/extraction/usage-logger.ts src/lib/db/queries/ai-usage.ts
git commit -m "feat: add AI usage logger service and aggregation queries"
```

---

## Task 3: Pipeline Integration — Write Usage Logs

**Files:**
- Modify: `src/lib/services/extraction/pipeline.ts`

- [ ] **Step 1: Import logAiUsage in pipeline.ts**

Add at top of `src/lib/services/extraction/pipeline.ts`:

```typescript
import { logAiUsage } from "./usage-logger";
```

- [ ] **Step 2: Update extractDocument to accept tenantId and documentId, and log usage**

The function signature already accepts `tenantId`. Add `documentId` parameter and log after each tier. Update the function signature:

```typescript
export async function extractDocument(
  rawText: string,
  tenantId: string,
  documentId: string,
  imageBase64?: string,
  mimeType?: string
): Promise<ExtractionResult> {
```

After each tier completes successfully (after the `allTierResults.push(tierResult)` line for each tier), add a non-blocking usage log call. For example, after Tier 1 push (around line 107):

```typescript
allTierResults.push(tier1Result);
bestResult = tier1Result;

// Log Tier 1 usage (non-blocking)
logAiUsage({
  tenantId,
  documentId,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  tier: 1,
  inputTokens: tier1Raw.data.confidence ? 0 : 0, // tokens are in tier1Raw
  outputTokens: 0,
  costUsd: tier1Raw.costUsd,
  metadata: { escalationReasons: reasons },
});
```

However, the actual token counts are computed inside the tier functions. The cleanest approach is to extend the `TierResult` type to include token counts, OR log from inside each tier function. Since TierResult already has `costUsd`, add `inputTokens` and `outputTokens` to the type.

**Better approach:** Add `inputTokens` and `outputTokens` to the `TierResult` interface in `types.ts`:

```typescript
export interface TierResult {
  tier: 1 | 2 | 3;
  data: ExtractedData;
  validation: ValidationResult;
  escalationReasons: string[];
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
}
```

Then update each tier file (`tier1-haiku.ts`, `tier2-sonnet.ts`, `tier3-vision.ts`) to return these fields. They already compute them — just return them in the result.

In `tier1-haiku.ts`, the return becomes:

```typescript
return {
  tier: 1,
  data,
  validation,
  escalationReasons: [],
  costUsd,
  inputTokens,
  outputTokens,
  model: "claude-haiku-4-5-20251001",
};
```

Apply same pattern to tier2 and tier3.

- [ ] **Step 3: Add usage logging in buildResult**

In the `buildResult` function, after computing totalCostUsd, log all tier results:

```typescript
function buildResult(
  best: TierResult,
  allTierResults: TierResult[],
  tenantId: string,
  documentId: string
): ExtractionResult {
  const totalCostUsd = allTierResults.reduce((sum, r) => sum + r.costUsd, 0);

  // Log usage for each tier (non-blocking, fire-and-forget)
  for (const tierResult of allTierResults) {
    logAiUsage({
      tenantId,
      documentId,
      provider: "anthropic",
      model: tierResult.model,
      tier: tierResult.tier,
      inputTokens: tierResult.inputTokens,
      outputTokens: tierResult.outputTokens,
      costUsd: tierResult.costUsd,
      metadata: {
        escalationReasons: tierResult.escalationReasons,
        validationValid: tierResult.validation.overallValid,
      },
    });
  }

  return {
    data: best.data,
    tierUsed: best.tier,
    allTierResults,
    validation: best.validation,
    escalationReasons: best.escalationReasons,
    totalCostUsd,
  };
}
```

Update all calls to `buildResult` to pass `tenantId` and `documentId`.

- [ ] **Step 4: Update the Inngest caller to pass documentId**

The Inngest function in `src/lib/inngest/functions/process-document.ts` calls `extractDocument()`. Find the call and add the `documentId` argument. It already has access to the document ID from the event/step.

- [ ] **Step 5: Verify build passes**

Run: `npx next build`

Expected: Build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/extraction/pipeline.ts src/lib/services/extraction/types.ts src/lib/services/extraction/tiers/ src/lib/inngest/functions/process-document.ts
git commit -m "feat: log AI usage to ai_usage_logs after each extraction tier"
```

---

## Task 4: Superadmin Auth — Middleware + Request Context

**Files:**
- Modify: `src/lib/supabase/middleware.ts`
- Modify: `src/lib/api/request-context.ts`

- [ ] **Step 1: Add isSuperadmin query to middleware.ts**

In `src/lib/supabase/middleware.ts`, after the role resolution block (around line 97), add a query for `is_superadmin`:

```typescript
// After: if (role !== "admin" && role !== "checker") role = "maker";
// Add superadmin check:
let isSuperadmin = false;
if (isApiRoute || request.nextUrl.pathname.startsWith("/backoffice")) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .single();
    isSuperadmin = profile?.is_superadmin === true;
  } catch {
    // Default to not superadmin
  }
}
```

Then after setting existing headers (around line 105), add:

```typescript
requestHeaders.set("x-is-superadmin", String(isSuperadmin));
```

Also add backoffice route protection before the existing response creation:

```typescript
// Block non-superadmin from backoffice routes
const isBackofficeRoute = request.nextUrl.pathname.startsWith("/backoffice") ||
  request.nextUrl.pathname.startsWith("/api/backoffice");
if (isBackofficeRoute && !isSuperadmin) {
  if (isApiRoute) {
    return NextResponse.json({ success: false, error: "Superadmin access required" }, { status: 403 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  return NextResponse.redirect(url);
}
```

- [ ] **Step 2: Update RequestContext type and getRequestContext**

In `src/lib/api/request-context.ts`, add `isSuperadmin` to the type:

```typescript
export type RequestContext = {
  userId: string;
  userEmail: string | null;
  tenantId: string;
  role: "admin" | "maker" | "checker";
  ipAddress: string | null;
  isSuperadmin: boolean;
};
```

In `getRequestContext`, read the header:

```typescript
const isSuperadmin = request.headers.get("x-is-superadmin") === "true";
```

Add it to the returned object in both the main path and dev fallback.

- [ ] **Step 3: Verify build passes**

Run: `npx next build`

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/middleware.ts src/lib/api/request-context.ts
git commit -m "feat: add superadmin auth check to middleware and request context"
```

---

## Task 5: Tenant Settings — AI Usage API

**Files:**
- Create: `src/app/api/settings/ai-usage/route.ts`

- [ ] **Step 1: Create the tenant AI usage API route**

```typescript
// src/app/api/settings/ai-usage/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getTenantUsageSummary } from "@/lib/db/queries/ai-usage";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [summary, prevSummary, tenantData] = await Promise.all([
    getTenantUsageSummary(ctx.tenantId, year, month),
    getTenantUsageSummary(
      ctx.tenantId,
      month === 1 ? year - 1 : year,
      month === 1 ? 12 : month - 1
    ),
    db
      .select({
        monthlyBudgetUsd: tenants.monthlyBudgetUsd,
        budgetAlertThreshold: tenants.budgetAlertThreshold,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1),
  ]);

  const budget = tenantData[0]?.monthlyBudgetUsd
    ? Number(tenantData[0].monthlyBudgetUsd)
    : null;
  const threshold = tenantData[0]?.budgetAlertThreshold
    ? Number(tenantData[0].budgetAlertThreshold)
    : 0.8;

  const costChange =
    prevSummary.totalCostUsd > 0
      ? Math.round(
          ((summary.totalCostUsd - prevSummary.totalCostUsd) /
            prevSummary.totalCostUsd) *
            100
        )
      : null;

  return NextResponse.json({
    success: true,
    data: {
      ...summary,
      costChange,
      budget,
      budgetAlertThreshold: threshold,
      budgetUsedPct: budget ? (summary.totalCostUsd / budget) * 100 : null,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/settings/ai-usage/route.ts
git commit -m "feat: add tenant AI usage settings API endpoint"
```

---

## Task 6: Tenant Settings — AI Usage Page

**Files:**
- Create: `src/app/(app)/settings/accounting/ai-usage/page.tsx`
- Create: `src/lib/hooks/use-ai-usage.ts`
- Create: `src/components/budget-progress-bar.tsx`
- Modify: `src/app/(app)/settings/layout.tsx`

- [ ] **Step 1: Create the React Query hook**

```typescript
// src/lib/hooks/use-ai-usage.ts
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

const isValidTenant = (id: string) =>
  !!id && id !== "00000000-0000-0000-0000-000000000000";

export function useTenantAiUsage() {
  const tenantId = getWorkspaceTenantId();
  return useQuery({
    queryKey: ["ai-usage", tenantId],
    queryFn: async () => {
      const res = await fetch("/api/settings/ai-usage", {
        headers: { "x-tenant-id": tenantId },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as {
        documentCount: number;
        totalCostUsd: number;
        avgCostPerDoc: number;
        tier1Count: number;
        tier2Count: number;
        tier3Count: number;
        costChange: number | null;
        budget: number | null;
        budgetAlertThreshold: number;
        budgetUsedPct: number | null;
      };
    },
    enabled: isValidTenant(tenantId),
  });
}
```

- [ ] **Step 2: Create BudgetProgressBar component**

```typescript
// src/components/budget-progress-bar.tsx
"use client";

interface BudgetProgressBarProps {
  spent: number;
  budget: number | null;
  threshold?: number;
  tier1Count?: number;
  tier2Count?: number;
  tier3Count?: number;
}

export function BudgetProgressBar({
  spent,
  budget,
  threshold = 0.8,
  tier1Count,
  tier2Count,
  tier3Count,
}: BudgetProgressBarProps) {
  if (budget === null) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 mt-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          No monthly budget set.{" "}
          <span className="underline cursor-pointer text-[var(--primary)]">
            Set budget
          </span>
        </p>
      </div>
    );
  }

  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const color =
    pct >= 100
      ? "var(--destructive)"
      : pct >= threshold * 100
        ? "var(--warning)"
        : "var(--success)";
  const statusText =
    pct >= 100
      ? "Over budget"
      : pct >= threshold * 100
        ? `${Math.round(pct)}% used — approaching limit`
        : `${Math.round(pct)}% used — on track`;
  const statusColor =
    pct >= 100
      ? "text-[var(--destructive)]"
      : pct >= threshold * 100
        ? "text-amber-700"
        : "text-[var(--success)]";

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--muted-foreground)]">
          Monthly Budget
        </span>
        <span className="text-sm font-semibold tabular-nums">
          ${spent.toFixed(2)} / ${budget.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--muted)]">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <p className={`mt-2 text-xs flex items-center gap-1.5 ${statusColor}`}>
        {statusText}
      </p>
      {(tier1Count !== undefined || tier2Count !== undefined || tier3Count !== undefined) && (
        <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
            Tier 1 (Haiku): {tier1Count ?? 0}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
            Tier 2 (Sonnet): {tier2Count ?? 0}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--warning)]" />
            Tier 3 (Vision): {tier3Count ?? 0}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the AI Usage settings page**

```typescript
// src/app/(app)/settings/accounting/ai-usage/page.tsx
"use client";

import { StatCard } from "@/components/stat-card";
import { BudgetProgressBar } from "@/components/budget-progress-bar";
import { Skeleton } from "@/components/skeleton";
import { useTenantAiUsage } from "@/lib/hooks/use-ai-usage";

export default function AiUsagePage() {
  const { data, isLoading } = useTenantAiUsage();

  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-semibold">AI Usage</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Monitor your AI extraction costs and usage this month
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const costTrend: "up" | "down" | "neutral" =
    data.costChange === null
      ? "neutral"
      : data.costChange > 0
        ? "up"
        : data.costChange < 0
          ? "down"
          : "neutral";

  const costTrendText =
    data.costChange !== null ? `${data.costChange > 0 ? "+" : ""}${data.costChange}% vs last month` : "First month";

  return (
    <div>
      <h2 className="text-lg font-semibold">AI Usage</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Monitor your AI extraction costs and usage this month
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Documents Processed"
          value={String(data.documentCount)}
          trend="neutral"
          trendValue="This month"
        />
        <StatCard
          title="Total AI Cost"
          value={`$${data.totalCostUsd.toFixed(2)}`}
          trend={costTrend}
          trendValue={costTrendText}
        />
        <StatCard
          title="Avg Cost / Document"
          value={`$${data.avgCostPerDoc.toFixed(3)}`}
          trend="neutral"
          trendValue="Blended across tiers"
        />
      </div>

      <BudgetProgressBar
        spent={data.totalCostUsd}
        budget={data.budget}
        threshold={data.budgetAlertThreshold}
        tier1Count={data.tier1Count}
        tier2Count={data.tier2Count}
        tier3Count={data.tier3Count}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add AI Usage to Settings sidebar nav**

In `src/app/(app)/settings/layout.tsx`, add to the ACCOUNTING group items array (after "Report Retention"):

```typescript
import { /* existing imports */, DollarSign } from "lucide-react";
```

Add to the ACCOUNTING items:

```typescript
{ label: "AI Usage", href: "/settings/accounting/ai-usage", icon: DollarSign },
```

- [ ] **Step 5: Verify page renders**

Run: `npx next dev`

Navigate to `/settings/accounting/ai-usage`. Should show stat cards and budget bar (empty data is fine).

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/settings/accounting/ai-usage/ src/lib/hooks/use-ai-usage.ts src/components/budget-progress-bar.tsx src/app/(app)/settings/layout.tsx
git commit -m "feat: add tenant AI Usage page in Settings with stat cards and budget bar"
```

---

## Task 7: Backoffice Layout + Sidebar

**Files:**
- Create: `src/components/backoffice-sidebar.tsx`
- Create: `src/app/(backoffice)/layout.tsx`
- Create: `src/app/(backoffice)/backoffice/page.tsx`
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Create BackofficeSidebar component**

```typescript
// src/components/backoffice-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  BarChart3,
  Wrench,
  Users,
  LogOut,
} from "lucide-react";

const navGroups = [
  {
    label: "ANALYTICS",
    items: [
      { href: "/backoffice/overview", label: "AI Overview", icon: LayoutGrid },
      { href: "/backoffice/cost-analysis", label: "Cost Analysis", icon: BarChart3, disabled: true },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { href: "/backoffice/rules", label: "Extraction Rules", icon: Wrench },
      { href: "/backoffice/tenants", label: "Tenants", icon: Users },
    ],
  },
];

export function BackofficeSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[var(--border)] bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-white text-xs font-bold">
          AI
        </div>
        <span className="text-[15px] font-semibold text-[var(--foreground)]">
          AICount
        </span>
        <span className="ml-1 rounded-full bg-[var(--destructive)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
          BACKOFFICE
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname?.startsWith(item.href + "/");
              const Icon = item.icon;
              const disabled = "disabled" in item && item.disabled;

              if (disabled) {
                return (
                  <span
                    key={item.href}
                    className="flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium text-[var(--muted-foreground)] opacity-50 cursor-default"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 ${
                    isActive
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : "text-[var(--secondary)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[12px] font-medium text-[var(--secondary)] hover:bg-[var(--muted)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create backoffice layout**

```typescript
// src/app/(backoffice)/layout.tsx
import { BackofficeSidebar } from "@/components/backoffice-sidebar";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[var(--background)]">
      <BackofficeSidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create backoffice index redirect**

```typescript
// src/app/(backoffice)/backoffice/page.tsx
import { redirect } from "next/navigation";

export default function BackofficePage() {
  redirect("/backoffice/overview");
}
```

- [ ] **Step 4: Add Backoffice link to main sidebar**

In `src/components/sidebar.tsx`, add a conditional "Backoffice" link in the bottom section. This requires knowing if the user is superadmin. Read it from a cookie or API call. The simplest approach for MVP: pass it as a prop or read from a client-side fetch.

Add after the Settings link in the bottom section:

```typescript
import { Shield } from "lucide-react";
```

After the existing Settings link block (around line 118), add:

```typescript
{/* Backoffice link — shown to superadmins */}
{/* For MVP, we check via an API call or pass from layout */}
```

For now, use a simple approach: create a small hook that checks superadmin status, or conditionally render based on a header. The simplest MVP approach is to add a `BackofficeLink` client component that fetches the user's profile once.

- [ ] **Step 5: Verify build passes**

Run: `npx next build`

- [ ] **Step 6: Commit**

```bash
git add src/components/backoffice-sidebar.tsx src/app/(backoffice)/ src/components/sidebar.tsx
git commit -m "feat: add backoffice layout, sidebar, and route structure"
```

---

## Task 8: Backoffice APIs

**Files:**
- Create: `src/app/api/backoffice/analytics/route.ts`
- Create: `src/app/api/backoffice/analytics/tenants/route.ts`
- Create: `src/app/api/backoffice/rules/route.ts`
- Create: `src/app/api/backoffice/rules/[id]/route.ts`
- Create: `src/app/api/backoffice/tenants/route.ts`

- [ ] **Step 1: Create overview analytics API**

```typescript
// src/app/api/backoffice/analytics/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { getPlatformOverview, getDailyCosts } from "@/lib/db/queries/ai-usage";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const yearParam = request.nextUrl.searchParams.get("year");
  const monthParam = request.nextUrl.searchParams.get("month");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

  const [overview, prevOverview, dailyCosts] = await Promise.all([
    getPlatformOverview(year, month),
    getPlatformOverview(
      month === 1 ? year - 1 : year,
      month === 1 ? 12 : month - 1
    ),
    getDailyCosts(year, month),
  ]);

  const costChange =
    prevOverview.totalCostUsd > 0
      ? Math.round(
          ((overview.totalCostUsd - prevOverview.totalCostUsd) /
            prevOverview.totalCostUsd) *
            100
        )
      : null;

  const docChange =
    prevOverview.totalDocuments > 0
      ? Math.round(
          ((overview.totalDocuments - prevOverview.totalDocuments) /
            prevOverview.totalDocuments) *
            100
        )
      : null;

  return NextResponse.json({
    success: true,
    data: {
      overview: { ...overview, costChange, docChange },
      dailyCosts,
    },
  });
}
```

- [ ] **Step 2: Create per-tenant usage API**

```typescript
// src/app/api/backoffice/analytics/tenants/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { getPerTenantUsage } from "@/lib/db/queries/ai-usage";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const params = request.nextUrl.searchParams;
  const now = new Date();
  const year = params.get("year") ? parseInt(params.get("year")!, 10) : now.getFullYear();
  const month = params.get("month") ? parseInt(params.get("month")!, 10) : now.getMonth() + 1;
  const search = params.get("search") || undefined;
  const page = params.get("page") ? parseInt(params.get("page")!, 10) : 1;
  const limit = Math.min(parseInt(params.get("limit") || "20", 10), 100);

  const result = await getPerTenantUsage(year, month, search, page, limit);

  return NextResponse.json({
    success: true,
    data: result.rows,
    meta: { total: result.total, page, limit },
  });
}
```

- [ ] **Step 3: Create rules list API**

```typescript
// src/app/api/backoffice/rules/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { aiExtractionRules, tenants } from "@/lib/db/schema";
import { and, eq, lt, gte, sql, count, desc, ilike, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const params = request.nextUrl.searchParams;
  const tenantFilter = params.get("tenantId") || undefined;
  const statusFilter = params.get("status") || undefined;
  const typeFilter = params.get("type") || undefined;
  const search = params.get("search") || undefined;
  const page = params.get("page") ? parseInt(params.get("page")!, 10) : 1;
  const limit = Math.min(parseInt(params.get("limit") || "20", 10), 100);
  const offset = (page - 1) * limit;

  const conditions = [];

  if (tenantFilter) {
    conditions.push(eq(aiExtractionRules.tenantId, tenantFilter));
  }
  if (statusFilter === "graduated") {
    conditions.push(eq(aiExtractionRules.isGraduated, true));
  } else if (statusFilter === "prompt") {
    conditions.push(eq(aiExtractionRules.isGraduated, false));
    conditions.push(gte(aiExtractionRules.confidence, "0.50"));
  } else if (statusFilter === "low") {
    conditions.push(lt(aiExtractionRules.confidence, "0.50"));
  }
  if (typeFilter) {
    conditions.push(eq(aiExtractionRules.ruleType, typeFilter));
  }
  if (search) {
    conditions.push(
      or(
        ilike(aiExtractionRules.ruleText, `%${search}%`),
        ilike(aiExtractionRules.triggerValue, `%${search}%`),
        ilike(aiExtractionRules.fieldName, `%${search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countResult]] = await Promise.all([
    db
      .select({
        rule: aiExtractionRules,
        tenantName: tenants.name,
      })
      .from(aiExtractionRules)
      .leftJoin(tenants, eq(aiExtractionRules.tenantId, tenants.id))
      .where(where)
      .orderBy(desc(aiExtractionRules.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(aiExtractionRules)
      .where(where),
  ]);

  // Stats
  const [stats] = await db
    .select({
      total: count(),
      graduated: sql<number>`COUNT(*) FILTER (WHERE ${aiExtractionRules.isGraduated} = true)`,
      prompt: sql<number>`COUNT(*) FILTER (WHERE ${aiExtractionRules.isGraduated} = false AND CAST(${aiExtractionRules.confidence} AS NUMERIC) >= 0.50)`,
      low: sql<number>`COUNT(*) FILTER (WHERE CAST(${aiExtractionRules.confidence} AS NUMERIC) < 0.50)`,
      tenantCount: sql<number>`COUNT(DISTINCT ${aiExtractionRules.tenantId})`,
    })
    .from(aiExtractionRules);

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      ...r.rule,
      tenantName: r.tenantName ?? "Global",
    })),
    meta: {
      total: Number(countResult?.total ?? 0),
      page,
      limit,
    },
    stats: {
      total: Number(stats?.total ?? 0),
      graduated: Number(stats?.graduated ?? 0),
      prompt: Number(stats?.prompt ?? 0),
      low: Number(stats?.low ?? 0),
      tenantCount: Number(stats?.tenantCount ?? 0),
    },
  });
}
```

- [ ] **Step 4: Create rule update/delete API**

```typescript
// src/app/api/backoffice/rules/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { aiExtractionRules } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = { updatedAt: sql`now()` };

  if (body.ruleText !== undefined) updateData.ruleText = body.ruleText;
  if (body.deterministicValue !== undefined) updateData.deterministicValue = body.deterministicValue;
  if (body.isGraduated !== undefined) updateData.isGraduated = body.isGraduated;
  if (body.confidence !== undefined) updateData.confidence = String(body.confidence);

  const [updated] = await db
    .update(aiExtractionRules)
    .set(updateData)
    .where(eq(aiExtractionRules.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Rule not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { id } = await params;

  const [deleted] = await db
    .delete(aiExtractionRules)
    .where(eq(aiExtractionRules.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json(
      { success: false, error: "Rule not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Create tenants list API**

```typescript
// src/app/api/backoffice/tenants/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { tenants, tenantAssignments, documents } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      taxId: tenants.taxId,
      monthlyBudgetUsd: tenants.monthlyBudgetUsd,
      createdAt: tenants.createdAt,
      memberCount: sql<number>`(SELECT COUNT(*) FROM tenant_assignments WHERE tenant_id = ${tenants.id})`,
      documentCount: sql<number>`(SELECT COUNT(*) FROM documents WHERE tenant_id = ${tenants.id})`,
    })
    .from(tenants)
    .orderBy(tenants.name);

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      memberCount: Number(r.memberCount),
      documentCount: Number(r.documentCount),
      monthlyBudgetUsd: r.monthlyBudgetUsd ? Number(r.monthlyBudgetUsd) : null,
    })),
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/backoffice/
git commit -m "feat: add backoffice API routes for analytics, rules, and tenants"
```

---

## Task 9: Backoffice — AI Overview Page

**Files:**
- Create: `src/app/(backoffice)/backoffice/overview/page.tsx`
- Create: `src/lib/hooks/use-backoffice.ts`
- Create: `src/components/daily-cost-chart.tsx`
- Create: `src/components/tier-distribution-chart.tsx`

- [ ] **Step 1: Create backoffice React Query hooks**

```typescript
// src/lib/hooks/use-backoffice.ts
import { useQuery } from "@tanstack/react-query";

export function useBackofficeAnalytics(year: number, month: number) {
  return useQuery({
    queryKey: ["backoffice-analytics", year, month],
    queryFn: async () => {
      const res = await fetch(
        `/api/backoffice/analytics?year=${year}&month=${month}`
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });
}

export function useBackofficeTenantUsage(
  year: number,
  month: number,
  search: string,
  page: number
) {
  return useQuery({
    queryKey: ["backoffice-tenant-usage", year, month, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        page: String(page),
        limit: "20",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/backoffice/analytics/tenants?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return { data: json.data, meta: json.meta };
    },
  });
}

export function useBackofficeRules(filters: {
  tenantId?: string;
  status?: string;
  type?: string;
  search?: string;
  page: number;
}) {
  return useQuery({
    queryKey: ["backoffice-rules", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(filters.page), limit: "20" });
      if (filters.tenantId) params.set("tenantId", filters.tenantId);
      if (filters.status) params.set("status", filters.status);
      if (filters.type) params.set("type", filters.type);
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/backoffice/rules?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return { data: json.data, meta: json.meta, stats: json.stats };
    },
  });
}

export function useBackofficeTenants() {
  return useQuery({
    queryKey: ["backoffice-tenants"],
    queryFn: async () => {
      const res = await fetch("/api/backoffice/tenants");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });
}
```

- [ ] **Step 2: Create DailyCostChart component**

```typescript
// src/components/daily-cost-chart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DailyCostChartProps {
  data: { date: string; dailyCost: number; cumulativeCost: number }[];
  budgetPace?: number; // total budget for month / days in month
}

// Recharts cannot read CSS variables — hardcode hex matching CSS vars
const PRIMARY_BLUE = "#2563EB"; // var(--primary)
const SUCCESS_GREEN = "#059669"; // var(--success)
const BORDER_GRAY = "#E2E8F0"; // var(--border)
const MUTED_FG = "#64748B"; // var(--muted-foreground)

export function DailyCostChart({ data, budgetPace }: DailyCostChartProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
      <h3 className="text-sm font-semibold mb-3">Daily AI Cost</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER_GRAY} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: MUTED_FG }}
            tickFormatter={(val: string) => val.slice(8)} // show day only
          />
          <YAxis
            tick={{ fontSize: 11, fill: MUTED_FG }}
            tickFormatter={(val: number) => `$${val.toFixed(2)}`}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(4)}`, ""]}
            labelFormatter={(label: string) => `Date: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="cumulativeCost"
            stroke={PRIMARY_BLUE}
            strokeWidth={2}
            dot={false}
            name="Cumulative Cost"
          />
          {budgetPace !== undefined && (
            <ReferenceLine
              y={budgetPace}
              stroke={SUCCESS_GREEN}
              strokeDasharray="4 4"
              label={{ value: "Budget pace", fontSize: 10, fill: SUCCESS_GREEN }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs text-[var(--muted-foreground)]">
        <span>
          <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: PRIMARY_BLUE }} />
          Cumulative cost
        </span>
        {budgetPace !== undefined && (
          <span>
            <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: SUCCESS_GREEN }} />
            Budget pace
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create TierDistributionChart component**

```typescript
// src/components/tier-distribution-chart.tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface TierDistributionChartProps {
  tier1: number;
  tier2: number;
  tier3: number;
  totalDocs: number;
}

// Recharts cannot read CSS variables — hardcode hex matching CSS vars
const TIER_COLORS = [
  "#059669", // var(--success) — Tier 1
  "#2563EB", // var(--primary) — Tier 2
  "#F59E0B", // var(--warning) — Tier 3
];

export function TierDistributionChart({
  tier1,
  tier2,
  tier3,
  totalDocs,
}: TierDistributionChartProps) {
  const data = [
    { name: "Tier 1 (Haiku)", value: tier1 },
    { name: "Tier 2 (Sonnet)", value: tier2 },
    { name: "Tier 3 (Vision)", value: tier3 },
  ].filter((d) => d.value > 0);

  const total = tier1 + tier2 + tier3;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
      <h3 className="text-sm font-semibold mb-3">Tier Distribution</h3>
      <div className="flex items-center">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={TIER_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, "docs"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="ml-4 space-y-2">
          {[
            { label: "Tier 1 (Haiku)", count: tier1, color: TIER_COLORS[0] },
            { label: "Tier 2 (Sonnet)", count: tier2, color: TIER_COLORS[1] },
            { label: "Tier 3 (Vision)", count: tier3, color: TIER_COLORS[2] },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-xs text-[var(--secondary)]"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color }}
              />
              {item.label}
              <span className="ml-auto font-semibold tabular-nums">
                {total > 0 ? Math.round((item.count / total) * 100) : 0}%
              </span>
            </div>
          ))}
          <div className="pt-1 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
            {totalDocs.toLocaleString()} documents
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the AI Overview page**

Create `src/app/(backoffice)/backoffice/overview/page.tsx` — a `"use client"` page using `useBackofficeAnalytics` and `useBackofficeTenantUsage` hooks. Layout: 4 StatCards at top, chart row (DailyCostChart 2/3 + TierDistributionChart 1/3), per-tenant DataTable with search and pagination. Include a month picker `<select>` in the header.

This is a large component (~200 lines). Build it using the existing patterns from the dashboard page: StatCard grid, Card wrappers for chart sections, DataTable for the tenant table with `tabular-nums` on financial columns.

- [ ] **Step 5: Verify page renders**

Run: `npx next dev`, navigate to `/backoffice/overview`.

- [ ] **Step 6: Commit**

```bash
git add src/app/(backoffice)/backoffice/overview/ src/lib/hooks/use-backoffice.ts src/components/daily-cost-chart.tsx src/components/tier-distribution-chart.tsx
git commit -m "feat: add backoffice AI Overview dashboard with charts and tenant table"
```

---

## Task 10: Backoffice — Extraction Rules Page

**Files:**
- Create: `src/app/(backoffice)/backoffice/rules/page.tsx`

- [ ] **Step 1: Create the rules management page**

Create `src/app/(backoffice)/backoffice/rules/page.tsx` — a `"use client"` page using `useBackofficeRules` hook. Layout:

- 4 StatCards (Total Rules, Graduated, Prompt-Injected, Low Confidence) — use `stats` from the API response
- Filter bar: 3 `<select>` elements (tenant, status, type) + search `<input>`
- DataTable with expandable rows — use `onRowClick` to toggle expanded state via local `useState`
- Expanded row shows: rule text, deterministic value, dates, action buttons (Edit, Graduate/Demote, Delete)
- Action buttons call PATCH/DELETE to `/api/backoffice/rules/[id]` then `refetch()`
- Pagination at bottom

Follow the existing DataTable expandable row pattern from the documents page. Use Badge component for rule type and status. Use the ConfidenceBar pattern (or create inline) for confidence display.

- [ ] **Step 2: Verify page renders**

Run: `npx next dev`, navigate to `/backoffice/rules`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(backoffice)/backoffice/rules/
git commit -m "feat: add backoffice extraction rules management page"
```

---

## Task 11: Backoffice — Tenants Page

**Files:**
- Create: `src/app/(backoffice)/backoffice/tenants/page.tsx`

- [ ] **Step 1: Create the tenants list page**

Create `src/app/(backoffice)/backoffice/tenants/page.tsx` — a `"use client"` page using `useBackofficeTenants` hook. Simple DataTable with columns: Name, Tax ID, Members, Documents, AI Spend (month), Budget, Created. Read-only, no actions. Use `tabular-nums` on numeric columns.

- [ ] **Step 2: Commit**

```bash
git add src/app/(backoffice)/backoffice/tenants/
git commit -m "feat: add backoffice tenants list page"
```

---

## Task 12: Build Verification + Final Cleanup

- [ ] **Step 1: Run full build**

Run: `npx next build`

Fix any type errors or build issues.

- [ ] **Step 2: Verify all routes work**

Manual testing checklist:
- `/settings/accounting/ai-usage` — shows stat cards and budget bar
- `/backoffice` — redirects to `/backoffice/overview`
- `/backoffice/overview` — shows analytics dashboard
- `/backoffice/rules` — shows rules with filters and expandable rows
- `/backoffice/tenants` — shows tenant list
- Non-superadmin hitting `/backoffice` — redirects to `/dashboard`

- [ ] **Step 3: Set yourself as superadmin**

Run in Supabase SQL editor:
```sql
UPDATE profiles SET is_superadmin = true WHERE email = 'your-email@example.com';
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve any build errors from Phase 6B implementation"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All success criteria from the spec are covered (schema, pipeline, auth, tenant settings, backoffice overview, rules, tenants)
- [x] **Placeholder scan:** No TBD/TODO/fill-in-later in any task
- [x] **Type consistency:** `TierResult` extended with `inputTokens`, `outputTokens`, `model` — used consistently in pipeline and usage-logger
- [x] **Naming consistency:** `isSuperadmin` in TypeScript, `is_superadmin` in DB/headers — matches existing camelCase/snake_case convention
- [x] **API pattern consistency:** All backoffice routes use `ctx.isSuperadmin` check, all return `{ success, data, meta? }` envelope
- [x] **Component pattern consistency:** All new components use CSS variables, Lucide icons, existing design tokens
