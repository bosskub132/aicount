# Phase 4A: Financial Statements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 financial/accounting reports with interactive screen views, server-side PDF generation, report history with versioning/locking, and configurable retention policy.

**Architecture:** Report Hub at `/reports/financial` links to 7 sub-pages. Each page queries data via React Query hooks → API routes → Drizzle queries. "Generate PDF" renders `@react-pdf/renderer` templates server-side, uploads to Supabase Storage, and saves to `report_history` table. Retention handled by daily Inngest cron.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, @react-pdf/renderer, Supabase Storage, Inngest, React Query, Zustand, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-25-phase4a-financial-statements-design.md`

---

## File Structure

### New Files to Create

**Schema & Constants:**
- `src/lib/db/queries/profit-loss.ts` — P&L aggregation query
- `src/lib/db/queries/balance-sheet.ts` — Balance sheet snapshot query
- `src/lib/db/queries/cash-flow.ts` — Cash flow indirect method query
- `src/lib/db/queries/journal-listing.ts` — Journal entries list for period
- `src/lib/db/queries/report-history.ts` — CRUD for report_history table
- `src/lib/db/queries/report-retention.ts` — CRUD for report_retention_policy table

**Services:**
- `src/lib/services/report-generator.ts` — Orchestrator: data → PDF → Storage → history
- `src/lib/services/report-pdf-templates.ts` — @react-pdf/renderer templates (7 reports)
- `src/lib/services/report-retention.ts` — Expiry computation, validation

**Hooks:**
- `src/lib/hooks/use-trial-balance.ts` — NEW (replaces inline fetch)
- `src/lib/hooks/use-profit-loss.ts`
- `src/lib/hooks/use-balance-sheet.ts`
- `src/lib/hooks/use-cash-flow.ts`
- `src/lib/hooks/use-monthly-comparison.ts` — NEW (replaces inline fetch)
- `src/lib/hooks/use-gl-detail.ts`
- `src/lib/hooks/use-journal-listing.ts`
- `src/lib/hooks/use-report-history.ts`
- `src/lib/hooks/use-report-pdf.ts`
- `src/lib/hooks/use-report-retention.ts`

**Components:**
- `src/components/period-picker.tsx`
- `src/components/report-filter-bar.tsx`
- `src/components/report-stat-cards.tsx`
- `src/components/pdf-preview-modal.tsx`
- `src/components/report-history-drawer.tsx`

**Pages:**
- `src/app/(app)/reports/financial/page.tsx` — Hub
- `src/app/(app)/reports/financial/trial-balance/page.tsx`
- `src/app/(app)/reports/financial/profit-loss/page.tsx`
- `src/app/(app)/reports/financial/balance-sheet/page.tsx`
- `src/app/(app)/reports/financial/cash-flow/page.tsx`
- `src/app/(app)/reports/financial/monthly-comparison/page.tsx`
- `src/app/(app)/reports/financial/gl-detail/page.tsx`
- `src/app/(app)/reports/financial/journal-listing/page.tsx`
- `src/app/(app)/settings/accounting/report-retention/page.tsx`

**API Routes:**
- `src/app/api/tenants/[id]/reports/profit-loss/route.ts`
- `src/app/api/tenants/[id]/reports/balance-sheet/route.ts`
- `src/app/api/tenants/[id]/reports/cash-flow/route.ts`
- `src/app/api/tenants/[id]/reports/gl-detail/route.ts`
- `src/app/api/tenants/[id]/reports/journal-listing/route.ts`
- `src/app/api/tenants/[id]/reports/generate-pdf/route.ts`
- `src/app/api/tenants/[id]/reports/history/route.ts`
- `src/app/api/tenants/[id]/reports/history/[reportId]/route.ts`
- `src/app/api/tenants/[id]/settings/report-retention/route.ts`

**Background Job:**
- `src/lib/inngest/functions/report-cleanup.ts`

### Files to Modify

- `src/lib/db/schema.ts` — Add `report_history`, `report_retention_policy` tables + `cash_flow_category` on `chart_of_accounts`
- `src/lib/db/relations.ts` — Add relations for new tables (if exists)
- `src/lib/utils/constants.ts` — Add `REPORT_RETENTION_CATEGORY` mapping
- `src/app/api/tenants/[id]/reports/trial-balance/route.ts` — Fix join path (journalEntries not documents), add scope param
- `src/app/api/tenants/[id]/reports/monthly-comparison/route.ts` — Add year param
- `src/app/(app)/settings/layout.tsx` — Add "Report Retention" nav entry
- `src/components/sidebar.tsx` — Verify `/reports/financial` link (should already exist)

---

## Task Breakdown

### Task 1: Schema — report_history & report_retention_policy tables

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/utils/constants.ts`

- [ ] **Step 1: Add report_history table to schema.ts**

Add after the existing `bankReconMatches` table definition:

```typescript
export const reportHistory = pgTable(
  "report_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reportType: varchar("report_type", { length: 50 }).notNull(),
    period: varchar("period", { length: 20 }).notNull(),
    periodScope: varchar("period_scope", { length: 20 }).notNull(),
    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to").notNull(),
    filters: jsonb("filters"),
    pdfStoragePath: text("pdf_storage_path"),
    pdfSizeBytes: integer("pdf_size_bytes"),
    generatedBy: uuid("generated_by").references(() => profiles.id),
    lockedAt: timestamp("locked_at"),
    lockedBy: uuid("locked_by").references(() => profiles.id),
    deletedAt: timestamp("deleted_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("report_history_draft_idx")
      .on(table.tenantId, table.reportType, table.period, table.periodScope)
      .where(sql`locked_at IS NULL AND deleted_at IS NULL`),
  ]
);
```

- [ ] **Step 2: Add report_retention_policy table to schema.ts**

```typescript
export const reportRetentionPolicy = pgTable("report_retention_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  draftRetentionDays: integer("draft_retention_days").default(30).notNull(),
  trashRecoveryDays: integer("trash_recovery_days").default(7).notNull(),
  financialRetentionValue: integer("financial_retention_value").default(7).notNull(),
  financialRetentionUnit: varchar("financial_retention_unit", { length: 10 }).default("years").notNull(),
  taxRetentionValue: integer("tax_retention_value").default(7).notNull(),
  taxRetentionUnit: varchar("tax_retention_unit", { length: 10 }).default("years").notNull(),
  whtRetentionValue: integer("wht_retention_value").default(7).notNull(),
  whtRetentionUnit: varchar("wht_retention_unit", { length: 10 }).default("years").notNull(),
  managementRetentionValue: integer("management_retention_value").default(2).notNull(),
  managementRetentionUnit: varchar("management_retention_unit", { length: 10 }).default("years").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => profiles.id),
});
```

- [ ] **Step 3: Add cash_flow_category to chart_of_accounts**

In the existing `chartOfAccounts` table definition, add:

```typescript
cashFlowCategory: varchar("cash_flow_category", { length: 20 }),
```

- [ ] **Step 4: Add REPORT_RETENTION_CATEGORY to constants.ts**

```typescript
export const REPORT_RETENTION_CATEGORY: Record<string, string> = {
  trial_balance: "financial",
  profit_loss: "financial",
  balance_sheet: "financial",
  cash_flow: "financial",
  monthly_comparison: "management",
  gl_detail: "management",
  journal_listing: "management",
};
```

- [ ] **Step 5: Generate migration**

Run: `npx drizzle-kit generate`

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/utils/constants.ts supabase/migrations/
git commit -m "feat: add report_history, report_retention_policy tables and cash_flow_category column"
```

---

### Task 2: Report Retention — queries, API, service

**Files:**
- Create: `src/lib/db/queries/report-retention.ts`
- Create: `src/lib/services/report-retention.ts`
- Create: `src/app/api/tenants/[id]/settings/report-retention/route.ts`

- [ ] **Step 1: Create report-retention query module**

Create `src/lib/db/queries/report-retention.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reportRetentionPolicy } from "@/lib/db/schema";

export async function getRetentionPolicy(tenantId: string) {
  const rows = await db
    .select()
    .from(reportRetentionPolicy)
    .where(eq(reportRetentionPolicy.tenantId, tenantId))
    .limit(1);

  if (rows.length === 0) {
    // Return defaults — policy row doesn't exist yet
    return {
      draftRetentionDays: 30,
      trashRecoveryDays: 7,
      financialRetentionValue: 7,
      financialRetentionUnit: "years" as const,
      taxRetentionValue: 7,
      taxRetentionUnit: "years" as const,
      whtRetentionValue: 7,
      whtRetentionUnit: "years" as const,
      managementRetentionValue: 2,
      managementRetentionUnit: "years" as const,
    };
  }

  return rows[0];
}

export async function upsertRetentionPolicy(
  tenantId: string,
  data: Partial<typeof reportRetentionPolicy.$inferInsert>,
  updatedBy: string
) {
  const existing = await db
    .select({ id: reportRetentionPolicy.id })
    .from(reportRetentionPolicy)
    .where(eq(reportRetentionPolicy.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) {
    return db
      .update(reportRetentionPolicy)
      .set({ ...data, updatedAt: new Date(), updatedBy })
      .where(eq(reportRetentionPolicy.tenantId, tenantId))
      .returning();
  }

  return db
    .insert(reportRetentionPolicy)
    .values({ ...data, tenantId, updatedBy })
    .returning();
}
```

- [ ] **Step 2: Create report-retention service**

Create `src/lib/services/report-retention.ts`:

```typescript
import { REPORT_RETENTION_CATEGORY } from "@/lib/utils/constants";

interface RetentionPolicy {
  draftRetentionDays: number;
  financialRetentionValue: number;
  financialRetentionUnit: string;
  taxRetentionValue: number;
  taxRetentionUnit: string;
  whtRetentionValue: number;
  whtRetentionUnit: string;
  managementRetentionValue: number;
  managementRetentionUnit: string;
}

function addDuration(date: Date, value: number, unit: string): Date {
  const result = new Date(date);
  switch (unit) {
    case "days":
      result.setDate(result.getDate() + value);
      break;
    case "months":
      result.setMonth(result.getMonth() + value);
      break;
    case "years":
      result.setFullYear(result.getFullYear() + value);
      break;
  }
  return result;
}

export function computeExpiresAt(
  reportType: string,
  isLocked: boolean,
  policy: RetentionPolicy
): Date {
  const now = new Date();

  if (!isLocked) {
    return addDuration(now, policy.draftRetentionDays, "days");
  }

  const category = REPORT_RETENTION_CATEGORY[reportType] || "management";
  const key = `${category}RetentionValue` as keyof RetentionPolicy;
  const unitKey = `${category}RetentionUnit` as keyof RetentionPolicy;
  const value = Number(policy[key]);
  const unit = String(policy[unitKey]);

  return addDuration(now, value, unit);
}

export function validateRetentionPolicy(data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const draftDays = Number(data.draftRetentionDays);
  const trashDays = Number(data.trashRecoveryDays);

  if (draftDays < 1 || draftDays > 90) errors.push("Draft retention must be 1-90 days");
  if (trashDays < 1 || trashDays > 30) errors.push("Trash recovery must be 1-30 days");

  const units = ["days", "months", "years"];
  for (const cat of ["financial", "tax", "wht", "management"]) {
    const val = Number(data[`${cat}RetentionValue`]);
    const unit = String(data[`${cat}RetentionUnit`]);
    if (val < 1) errors.push(`${cat} retention value must be >= 1`);
    if (val > 99 && unit === "years") errors.push(`${cat} retention max 99 years`);
    if (!units.includes(unit)) errors.push(`${cat} retention unit must be days/months/years`);
  }

  return errors;
}
```

- [ ] **Step 3: Create retention settings API route**

Create `src/app/api/tenants/[id]/settings/report-retention/route.ts` with GET and PUT handlers following the auth pattern.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/queries/report-retention.ts src/lib/services/report-retention.ts src/app/api/tenants/
git commit -m "feat: add report retention policy queries, service, and API"
```

---

### Task 3: Report History — queries, API routes

**Files:**
- Create: `src/lib/db/queries/report-history.ts`
- Create: `src/app/api/tenants/[id]/reports/history/route.ts`
- Create: `src/app/api/tenants/[id]/reports/history/[reportId]/route.ts`

- [ ] **Step 1: Create report-history query module**

`src/lib/db/queries/report-history.ts` with functions:
- `listReportHistory(tenantId, filters)` — paginated, filterable by report_type, status (locked/draft/trash)
- `getReportHistory(tenantId, reportId)` — single record
- `upsertReportDraft(tenantId, data)` — insert or replace draft for type+period
- `lockReport(tenantId, reportId, userId)` — set locked_at/locked_by, recompute expires_at
- `unlockReport(tenantId, reportId)` — clear locked_at/locked_by, recompute expires_at
- `softDeleteReport(tenantId, reportId)` — set deleted_at
- `restoreReport(tenantId, reportId)` — clear deleted_at
- `countAffectedByRetentionChange(tenantId, category, newExpiresAt)` — for confirmation dialog

- [ ] **Step 2: Create history list API route (GET)**

`src/app/api/tenants/[id]/reports/history/route.ts` — paginated list with auth.

- [ ] **Step 3: Create history detail API route (GET, PATCH, DELETE)**

`src/app/api/tenants/[id]/reports/history/[reportId]/route.ts`:
- GET: single report detail
- PATCH: lock/unlock/restore actions
- DELETE: soft delete

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/queries/report-history.ts src/app/api/tenants/
git commit -m "feat: add report history CRUD queries and API routes"
```

---

### Task 4: Fix Trial Balance query — join through journalEntries

**Files:**
- Modify: `src/app/api/tenants/[id]/reports/trial-balance/route.ts`

- [ ] **Step 1: Refactor trial balance query**

The existing route joins `journalLines → documents` which excludes manual JVs. Refactor to join `journalLines → journalEntries` for tenant scoping. Also add `scope` query param (monthly/quarterly/yearly).

Key change:
```typescript
// BEFORE (WRONG — excludes manual JVs):
.innerJoin(documents, eq(journalLines.documentId, documents.id))
.where(eq(documents.tenantId, id))

// AFTER (CORRECT):
.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
.where(eq(journalEntries.tenantId, id))
```

- [ ] **Step 2: Verify with existing test data (if any)**

Run the dev server and test the endpoint:
```bash
curl -H "x-user-id: UUID" -H "x-tenant-id: UUID" -H "x-user-role: admin" \
  "http://localhost:3000/api/tenants/UUID/reports/trial-balance?period=2026-03"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tenants/
git commit -m "fix: trial balance query joins through journalEntries to include manual JVs"
```

---

### Task 5: Report data queries — P&L, Balance Sheet, Cash Flow, GL Detail, Journal Listing

**Files:**
- Create: `src/lib/db/queries/profit-loss.ts`
- Create: `src/lib/db/queries/balance-sheet.ts`
- Create: `src/lib/db/queries/cash-flow.ts`
- Create: `src/lib/db/queries/journal-listing.ts`

- [ ] **Step 1: Create profit-loss.ts**

Query: aggregate journalLines by account, group by category (revenue/expense), join through journalEntries for tenant scoping. Return: rows with accountCode, accountName, category, totalDebit, totalCredit, netAmount + summary totals.

- [ ] **Step 2: Create balance-sheet.ts**

Query: aggregate all journalLines up to period end date, group by account category (asset/liability/equity). Return: rows + A = L + E check.

- [ ] **Step 3: Create cash-flow.ts**

Query: net income from P&L + classify account movements by `cash_flow_category` (operating/investing/financing). Return: three sections + net cash change.

- [ ] **Step 4: Create journal-listing.ts**

Query: all journal entries for period with lines, joined through journalEntries. Return: entries grouped by type (manual/auto/adjustment) with line details.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/queries/
git commit -m "feat: add P&L, balance sheet, cash flow, and journal listing query modules"
```

---

### Task 6: Report data API routes

**Files:**
- Create: `src/app/api/tenants/[id]/reports/profit-loss/route.ts`
- Create: `src/app/api/tenants/[id]/reports/balance-sheet/route.ts`
- Create: `src/app/api/tenants/[id]/reports/cash-flow/route.ts`
- Create: `src/app/api/tenants/[id]/reports/gl-detail/route.ts`
- Create: `src/app/api/tenants/[id]/reports/journal-listing/route.ts`
- Modify: `src/app/api/tenants/[id]/reports/monthly-comparison/route.ts`

- [ ] **Step 1: Create P&L API route**

GET handler: auth → parse period/scope/department/comparison params → call query → return JSON.

- [ ] **Step 2: Create Balance Sheet API route**

Same pattern. Period resolves to end date for snapshot.

- [ ] **Step 3: Create Cash Flow API route**

Same pattern. Requires `cash_flow_category` on chart_of_accounts.

- [ ] **Step 4: Create GL Detail API route**

Same pattern. Requires `account` param. Reuses account-ledger query logic. Supports pagination (50 rows).

- [ ] **Step 5: Create Journal Listing API route**

Same pattern. Supports pagination (50 rows) and journal type filter.

- [ ] **Step 6: Enhance monthly-comparison route**

Add `year` query param, return 12 months of data.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/tenants/
git commit -m "feat: add report data API routes for P&L, balance sheet, cash flow, GL detail, journal listing"
```

---

### Task 7: Shared components — PeriodPicker, ReportFilterBar, ReportStatCards

**Files:**
- Create: `src/components/period-picker.tsx`
- Create: `src/components/report-filter-bar.tsx`
- Create: `src/components/report-stat-cards.tsx`

- [ ] **Step 1: Create PeriodPicker component**

Monthly/Quarterly/Yearly segmented toggle + month navigator (prev/next arrows + "March 2026" display). Props:
```typescript
interface PeriodPickerProps {
  scope: "monthly" | "quarterly" | "yearly";
  onScopeChange: (scope: string) => void;
  period: string; // "2026-03", "2026-Q1", "2026"
  onPeriodChange: (period: string) => void;
  allowCustomRange?: boolean;
  customFrom?: string;
  customTo?: string;
  onCustomRangeChange?: (from: string, to: string) => void;
  lockedScope?: "monthly" | "quarterly" | "yearly"; // locks scope toggle
}
```

- [ ] **Step 2: Create ReportFilterBar component**

Configurable filter bar with: PeriodPicker, Department select, Compare select, Advanced toggle. Config object determines which filters show per report type.

- [ ] **Step 3: Create ReportStatCards component**

Generic 4-card grid with colored left border. Props: array of `{ label, value, color, format }`.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: add PeriodPicker, ReportFilterBar, ReportStatCards components"
```

---

### Task 8: PDF infrastructure — PdfPreviewModal, ReportHistoryDrawer

**Files:**
- Create: `src/components/pdf-preview-modal.tsx`
- Create: `src/components/report-history-drawer.tsx`

- [ ] **Step 1: Create PdfPreviewModal**

Modal with iframe PDF viewer + bottom action bar (Download, Lock, Close). Uses `<Modal>` from design system.

- [ ] **Step 2: Create ReportHistoryDrawer**

Slide-in drawer listing past generations. Uses existing drawer/modal pattern. Tabs: All/Locked/Drafts/Trash.

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat: add PdfPreviewModal and ReportHistoryDrawer components"
```

---

### Task 9: React Query hooks

**Files:**
- Create: `src/lib/hooks/use-trial-balance.ts`
- Create: `src/lib/hooks/use-profit-loss.ts`
- Create: `src/lib/hooks/use-balance-sheet.ts`
- Create: `src/lib/hooks/use-cash-flow.ts`
- Create: `src/lib/hooks/use-monthly-comparison.ts`
- Create: `src/lib/hooks/use-gl-detail.ts`
- Create: `src/lib/hooks/use-journal-listing.ts`
- Create: `src/lib/hooks/use-report-history.ts`
- Create: `src/lib/hooks/use-report-pdf.ts`
- Create: `src/lib/hooks/use-report-retention.ts`

- [ ] **Step 1: Create report data hooks (7 hooks)**

Each follows the existing pattern in `src/lib/hooks/`:
```typescript
export function useProfitLoss(tenantId: string, params: { period: string; scope: string; department?: string; comparison?: string }) {
  return useQuery({
    queryKey: ["profit-loss", tenantId, params],
    queryFn: () => fetch(`/api/tenants/${tenantId}/reports/profit-loss?${new URLSearchParams(params)}`).then(r => r.json()),
    enabled: !!tenantId,
  });
}
```

- [ ] **Step 2: Create report history + PDF hooks**

`use-report-history.ts`: list query + lock/unlock/delete/restore mutations.
`use-report-pdf.ts`: generate PDF mutation.

- [ ] **Step 3: Create retention settings hook**

`use-report-retention.ts`: get query + update mutation.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks/
git commit -m "feat: add React Query hooks for all 7 reports, history, PDF, and retention"
```

---

### Task 10: Report Hub page

**Files:**
- Create: `src/app/(app)/reports/financial/page.tsx`

- [ ] **Step 1: Create Report Hub as Server Component**

Card grid with 2 sections (Financial Statements + Accounting Reports), 4-column layout. Each card links to sub-page. Uses lucide-react icons with colored backgrounds.

Follow mockup: `.superpowers/brainstorm/1772-1774376303/report-hub-v4.html`

- [ ] **Step 2: Verify navigation from sidebar**

Click "Financial Statements" in sidebar → should load the hub page.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/reports/
git commit -m "feat: add Financial Statements report hub page"
```

---

### Task 11: Individual report pages (7 pages)

**Files:**
- Create: `src/app/(app)/reports/financial/trial-balance/page.tsx`
- Create: `src/app/(app)/reports/financial/profit-loss/page.tsx`
- Create: `src/app/(app)/reports/financial/balance-sheet/page.tsx`
- Create: `src/app/(app)/reports/financial/cash-flow/page.tsx`
- Create: `src/app/(app)/reports/financial/monthly-comparison/page.tsx`
- Create: `src/app/(app)/reports/financial/gl-detail/page.tsx`
- Create: `src/app/(app)/reports/financial/journal-listing/page.tsx`

- [ ] **Step 1: Create Trial Balance page**

Pattern: `"use client"`, `<Suspense>` wrapper, stat cards + PeriodPicker (M/Q/Y) + DataTable with account rows. Grouped by account category with subtotals. "All Reports" back button + Export + Generate PDF.

- [ ] **Step 2: Create P&L page**

Same pattern. Revenue/Expense sections with group headers. Comparison column when selected. Net Profit highlighted row.

- [ ] **Step 3: Create Balance Sheet page**

Assets/Liabilities/Equity sections. A = L + E check in stat card.

- [ ] **Step 4: Create Cash Flow page**

Operating/Investing/Financing sections. Net Cash Change summary.

- [ ] **Step 5: Create Monthly Comparison page**

Yearly scope. 12 month columns + YTD. Future months show "—".

- [ ] **Step 6: Create GL Detail page**

Account picker required. Opening/closing balance banners. Paginated (50 rows). Custom range toggle.

- [ ] **Step 7: Create Journal Listing page**

Paginated (50 rows). Journal type filter. Custom range toggle. Grouped by entry with expandable lines.

- [ ] **Step 8: Commit each page or batch**

```bash
git commit -m "feat: add 7 individual financial report pages"
```

---

### Task 12: PDF templates

**Files:**
- Create: `src/lib/services/report-pdf-templates.ts`

- [ ] **Step 1: Create shared PDF layout**

Register Noto Sans Thai font. Create shared `ReportHeader`, `ReportFooter`, `ReportTable` PDF components.

- [ ] **Step 2: Create 7 report templates**

Each template: company header, report title + period, data table, footer with page number + generated date.
- `TrialBalancePdf`
- `ProfitLossPdf`
- `BalanceSheetPdf`
- `CashFlowPdf`
- `MonthlyComparisonPdf`
- `GlDetailPdf`
- `JournalListingPdf`

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/report-pdf-templates.ts
git commit -m "feat: add @react-pdf/renderer templates for 7 financial reports"
```

---

### Task 13: Report generator service + PDF API

**Files:**
- Create: `src/lib/services/report-generator.ts`
- Create: `src/app/api/tenants/[id]/reports/generate-pdf/route.ts`

- [ ] **Step 1: Create report-generator.ts**

Orchestrator: receives `{ tenantId, reportType, period, scope, filters }` → calls query → renders PDF → uploads to Supabase Storage (bucket: `report-pdfs`, private) → computes expires_at → upserts report_history → returns `{ reportId, pdfUrl }`.

- [ ] **Step 2: Create generate-pdf API route**

POST handler: auth → validate body → call report-generator → return result with signed URL.

- [ ] **Step 3: Test end-to-end**

Generate a P&L PDF via curl, verify Storage upload and report_history record.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/report-generator.ts src/app/api/tenants/
git commit -m "feat: add report generator service and generate-pdf API route"
```

---

### Task 14: Retention settings page

**Files:**
- Create: `src/app/(app)/settings/accounting/report-retention/page.tsx`
- Modify: `src/app/(app)/settings/layout.tsx`

- [ ] **Step 1: Add nav entry to settings layout**

Add "Report Retention" with Clock icon to the ACCOUNTING group.

- [ ] **Step 2: Create retention settings page**

Follow mockup: trash recovery card, draft retention card, locked reports table with retention inputs + unit dropdowns, info icon with lifecycle popover, save button with confirmation dialog.

Validation: min/max limits, legal minimum warnings, affected count.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/
git commit -m "feat: add report retention settings page with validation and confirmation dialog"
```

---

### Task 15: Report cleanup Inngest cron

**Files:**
- Create: `src/lib/inngest/functions/report-cleanup.ts`

- [ ] **Step 1: Create cleanup function**

Daily at 2:00 AM UTC+7:
1. Move expired reports to trash (set deleted_at) — LIMIT 100
2. Permanently delete trash past recovery period (per-tenant join) — LIMIT 100
3. Delete PDF from Supabase Storage for permanently deleted records
4. Log results

- [ ] **Step 2: Register in Inngest client**

Add to the Inngest function exports.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inngest/
git commit -m "feat: add daily report cleanup Inngest cron job"
```

---

### Task 16: Integration testing & polish

- [ ] **Step 1: Test all 7 report pages load with data**
- [ ] **Step 2: Test PDF generation for each report type**
- [ ] **Step 3: Test report history — lock, unlock, delete, restore**
- [ ] **Step 4: Test retention settings — save, validation, confirmation dialog**
- [ ] **Step 5: Test period picker — monthly/quarterly/yearly switching**
- [ ] **Step 6: Verify build passes**

Run: `npx next build`

- [ ] **Step 7: Final commit**

```bash
git commit -m "feat: Phase 4A Financial Statements complete — 7 reports, PDF generation, history, retention"
```
