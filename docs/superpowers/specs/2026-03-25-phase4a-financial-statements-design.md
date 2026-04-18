# Phase 4A: Financial Statements — Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Branch:** feature/app-v2
**Depends on:** Phase 3 (Accounting Modules) complete

---

## 1. Overview

Phase 4A adds 7 financial and accounting reports to AICount, with interactive screen views, server-side PDF generation with preview, report history with versioning/locking, and a configurable retention policy with soft delete.

### Reports Included

| # | Report | Thai Name | Category |
|---|--------|-----------|----------|
| 1 | Trial Balance | งบทดลอง | Financial Statement |
| 2 | Profit & Loss | งบกำไรขาดทุน | Financial Statement |
| 3 | Balance Sheet | งบแสดงฐานะการเงิน | Financial Statement |
| 4 | Cash Flow Statement | งบกระแสเงินสด | Financial Statement |
| 5 | Monthly Comparison | เปรียบเทียบรายเดือน | Accounting Report |
| 6 | GL Detail | รายละเอียดบัญชีแยกประเภท | Accounting Report |
| 7 | Journal Listing | รายการรายวัน | Accounting Report |

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Report mode | Interactive screen + formal PDF with preview | Best of both worlds for daily use and official submissions |
| Page layout | Report Hub (card grid) + individual sub-pages | Clean overview, each report gets full page space |
| Filters | Period picker (M/Q/Y) default, custom range for GL Detail & Journal Listing only | Matches Thai accounting practice; accountants work in standard periods |
| Filter UX | Simplified + Advanced expandable, state remembered per report (localStorage) | 90% use case visible, power users can expand |
| PDF generation | Server-side with @react-pdf/renderer | Already in project, React JSX templates, good Thai font support |
| PDF storage | Supabase Storage with path saved in report_history table | Audit trail, download anytime |
| Report history | Auto-save with versioning — one active draft per type+period, Lock to freeze | Clean history, locked = official version |
| Locked report behavior | Flexible — new draft created alongside locked version | Accountants can regenerate without losing the official version |
| Retention | Tiered — drafts in days, locked reports by category (day/month/year) | Different legal requirements per report type |
| Soft delete | 7-day configurable trash recovery before permanent deletion | Safety net for accidental deletion or policy changes |
| Cleanup | Daily Inngest cron, batch limit 100 per run | Simple, negligible cost (~1 SQL query/day when nothing expires) |
| UI consistency | Aligned with Phase 3 patterns | Same stat cards, inline filters, Button component, tabular-nums, CSS variables |

---

## 1.1 Critical Implementation Notes

### Query Join Path — MUST use journalEntries, not documents

The existing trial balance API joins `journalLines` through `documents` (`innerJoin(documents, eq(journalLines.documentId, documents.id))`). Since `journalLines.documentId` is nullable (manual JVs have no source document), this **silently excludes all manual journal entries** from the report.

**All report queries MUST join through `journalEntries` for tenant scoping:**
```
journalLines → journalEntries (via journalEntryId) → tenantId
```

**NOT:**
```
journalLines → documents (via documentId) → tenantId  ← WRONG: excludes manual JVs
```

The existing trial balance route must be refactored to use the correct join path as part of Phase 4A.

### Cash Flow Classification

The indirect method cash flow statement requires classifying accounts into Operating, Investing, and Financing categories. The current `chart_of_accounts` table does not have a `cash_flow_category` field.

**Solution:** Add `cash_flow_category` column to `chart_of_accounts`:
- Values: `operating`, `investing`, `financing`, `null` (unclassified defaults to operating)
- Default mapping by account category: Revenue/Expense → operating, Fixed Assets → investing, Long-term Debt/Equity → financing
- Tenant admin can override per account in COA settings
- Unclassified accounts show a warning on the Cash Flow report

### Report Type to Retention Category Mapping

A constant mapping is required to determine which retention policy applies to each report type:

```typescript
const REPORT_RETENTION_CATEGORY: Record<string, string> = {
  trial_balance: 'financial',
  profit_loss: 'financial',
  balance_sheet: 'financial',
  cash_flow: 'financial',
  monthly_comparison: 'management',
  gl_detail: 'management',
  journal_listing: 'management',
};
```

Defined in `src/lib/utils/constants.ts` and used by both `report-generator.ts` and `report-cleanup.ts`.

---

## 2. UI Design

### 2.1 Report Hub (`/reports/financial`)

A landing page with report cards in a 4-column grid, organized into two sections.

**Layout:**
- Page header: "Financial Statements" / "รายงานทางการเงิน" + period selector
- Section 1: "Financial Statements · งบการเงิน" — 4 cards (Trial Balance, P&L, Balance Sheet, Cash Flow)
- Section 2: "Accounting Reports · รายงานบัญชี" — 3 cards + 1 empty slot (Monthly Comparison, GL Detail, Journal Listing)
- All cards same width (4-column grid for both sections)
- Category titles: 16px bold with Thai subtitle below
- Each card: colored icon background (36px circle) + English title + Thai subtitle
- Click card → navigates to sub-page

**Card icons (lucide-react):**
- Trial Balance: `Tag` (blue #2563eb on #eff6ff)
- P&L: `BarChart3` (green #059669 on #f0fdf4)
- Balance Sheet: `Briefcase` (amber #d97706 on #fef3c7)
- Cash Flow: `DollarSign` (rose #e11d48 on #fce4ec)
- Monthly Comparison: `Table2` (purple #7c3aed on #f5f3ff)
- GL Detail: `FileText` (green #059669 on #ecfdf5)
- Journal Listing: `PenLine` (orange #ea580c on #fff7ed)

**Mockup reference:** `.superpowers/brainstorm/1772-1774376303/report-hub-v4.html`

### 2.2 Individual Report Page

Each report follows the Phase 3 page pattern:

```
<section className="space-y-5 p-6">
  {/* Page Header: h1 + subtitle + action buttons */}
  {/* Stat Cards: 4-col grid, colored left border */}
  {/* Filters: inline flex row */}
  {/* Data Table: grouped sections with subtotals */}
</section>
```

**Page Header:**
- `h1.text-xl.font-semibold` + Thai subtitle as `p.text-sm`
- Action buttons (right): "All Reports" (back), "History", "Export" (secondary), "Generate PDF" (primary)
- Uses `<Button>` component with `variant="secondary"` and `variant="primary"`

**Stat Cards (per report type):**

| Report | Card 1 | Card 2 | Card 3 | Card 4 |
|--------|--------|--------|--------|--------|
| Trial Balance | Total Debits | Total Credits | Accounts | Imbalance (if any) |
| P&L | Total Revenue | Total Expenses | Net Profit | Profit Margin % |
| Balance Sheet | Total Assets | Total Liabilities | Total Equity | A = L + E check |
| Cash Flow | Operating | Investing | Financing | Net Change |
| Monthly Comparison | YTD Revenue | YTD Expenses | YTD Net Profit | Best Month |
| GL Detail | Opening Balance | Total Debits | Total Credits | Closing Balance |
| Journal Listing | Total Entries | Total Amount | By Type (Auto/Manual) | Period |

**Mockup reference:** `.superpowers/brainstorm/1772-1774376303/report-page-layout-v3.html`

### 2.3 Filter Bar

**Filter availability per report:**

| Report | Period Picker | Custom Range | Scope (M/Q/Y) | Compare | Department | Account |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Trial Balance | Y | — | M/Q/Y | — | Y | — |
| P&L | Y | — | M/Q/Y | Y | Y | — |
| Balance Sheet | Y | — | M/Q/Y | Y | — | — |
| Cash Flow | Y | — | M/Q/Y | Y | — | — |
| Monthly Comparison | Y | — | Y only | — | Y | — |
| GL Detail | Y | Y | M/Q/Y | — | — | Y (required) |
| Journal Listing | Y | Y | M/Q/Y | — | — | — |

**Period Picker component (`<PeriodPicker>`):**
- Segmented toggle: Monthly / Quarterly / Yearly
- Month navigator: `<` prev | "March 2026" | next `>`
- Auto-resolves to date range displayed as hint text: "1 Mar — 31 Mar 2026"
- Quarterly shows: "Q1 2026" with Jan-Mar resolved
- Yearly shows: "2026" with Jan-Dec resolved

**Custom Range toggle (GL Detail & Journal Listing only):**
- Period / Custom Range segmented toggle
- When "Custom Range" active: shows from/to date inputs (replaces period picker)

**Compare dropdown (P&L, Balance Sheet, Cash Flow):**
- Options: None, vs Prior Month, vs Prior Year
- When active, data table adds comparison column + variance column

**Advanced Filters (expandable, remembers state per report via localStorage):**
- Show zero-balance accounts (Trial Balance, Balance Sheet) — toggle
- Account level depth: Summary / Detail (Trial Balance, P&L, Balance Sheet) — select
- Account range: from code — to code (Trial Balance, GL Detail) — two inputs
- Journal type: Manual / Auto / Adjustment (Journal Listing) — multi-select

### 2.4 PDF Preview Modal (`<PdfPreviewModal>`)

Triggered by "Generate PDF" button:

1. Shows loading state with progress
2. API generates PDF server-side, stores in Supabase Storage
3. Modal opens with:
   - PDF rendered in iframe (full width, ~80vh height)
   - Bottom bar: "Download" button, "Lock as Official" button, "Close" button
   - Report metadata: period, generated by, timestamp
4. If report already has a locked version for this period, shows info: "A locked version exists for March 2026. This will be saved as a new draft."

### 2.5 Report History Drawer (`<ReportHistoryDrawer>`)

Triggered by "History" button, slides in from right:

- List of past generations for this report type
- Each item shows: period, generated date, generated by, file size
- Status badges: "Draft" (amber), "Locked" (blue with lock icon), "Expiring" (warning), "Trash" (red)
- Actions per item: Download, Lock/Unlock, Delete (soft), Restore (from trash)
- Filter: All / Locked / Drafts / Trash tabs

### 2.6 Report Retention Settings

**Location:** Settings > Accounting > Report Retention (`/settings/accounting/report-retention`)

**Layout:**
- Page header: "Report Retention Policy" / "นโยบายการเก็บรักษารายงาน" + info icon (lifecycle popover)
- Trash Recovery Period card: configurable days (default 7)
- Draft Reports card: days only, default 30, auto-cleanup badge
- Locked Reports table: 4 categories with configurable retention (value + unit dropdown)

**Retention categories:**

| Category | Reports | Default | Unit Options | Legal Basis |
|----------|---------|---------|:---:|-------------|
| Financial Statements | Trial Balance, P&L, Balance Sheet, Cash Flow | 7 | days/months/years | พ.ร.บ.การบัญชี ม.14 |
| Tax Reports | ภ.พ.30, ภ.ง.ด.3, ภ.ง.ด.53, VAT Registers | 7 | days/months/years | ป.รัษฎากร ม.87/3 |
| WHT Certificates | 50 ทวิ | 7 | days/months/years | ป.รัษฎากร ม.50 ทวิ |
| Management Reports | Monthly Comparison, GL Detail, Journal Listing | 2 | days/months/years | None |

**Lifecycle (shown in info popover):**
Generated (Draft) → Locked (Official) → Expiring (Warning) → Trash (Recovery period) → Deleted (Permanent)

**Save Policy — Confirmation Dialog:**
- Shows change summary: old value → new value for each changed field
- Warning: "Reducing retention may cause existing reports that exceed the new limit to be moved to Trash within 24 hours"
- Shows affected report count when reducing retention
- Cancel / Confirm & Save buttons

**Validation rules:**
- Draft retention: min 1 day, max 90 days
- Locked report retention: min 1 day, max 99 years
- Trash recovery: min 1 day, max 30 days
- Legal minimum warning: if Financial Statements or Tax Reports set below 5 years, show yellow warning (non-blocking)
- Reducing retention shows affected count in confirm dialog

**Mockup reference:** `.superpowers/brainstorm/1772-1774376303/retention-settings-v3.html`, `retention-settings-v4.html`

---

## 3. Technical Architecture

### 3.1 Route Structure

```
src/app/(app)/reports/financial/
  page.tsx                          # Report Hub (Server Component)
  trial-balance/page.tsx
  profit-loss/page.tsx
  balance-sheet/page.tsx
  cash-flow/page.tsx
  monthly-comparison/page.tsx
  gl-detail/page.tsx
  journal-listing/page.tsx
```

### 3.2 API Routes

**Report data (GET):**
```
GET /api/tenants/{id}/reports/trial-balance      # Enhanced: add scope param (monthly/quarterly/yearly)
GET /api/tenants/{id}/reports/profit-loss         # NEW
GET /api/tenants/{id}/reports/balance-sheet       # NEW
GET /api/tenants/{id}/reports/cash-flow           # NEW
GET /api/tenants/{id}/reports/monthly-comparison  # Enhanced: accept year param
GET /api/tenants/{id}/reports/gl-detail           # NEW (reuses account-ledger query logic)
GET /api/tenants/{id}/reports/journal-listing     # NEW
```

**PDF & History:**
```
POST   /api/tenants/{id}/reports/generate-pdf               # Generate + store PDF
GET    /api/tenants/{id}/reports/history                     # List history (filterable)
PATCH  /api/tenants/{id}/reports/history/{reportId}          # Lock/unlock/restore
DELETE /api/tenants/{id}/reports/history/{reportId}          # Soft delete
```

**Settings:**
```
GET /api/tenants/{id}/settings/report-retention              # Get policy
PUT /api/tenants/{id}/settings/report-retention              # Update policy
```

All routes follow the existing auth pattern:
```typescript
const ctx = getRequestContext(request);
if (!ctx) return unauthorized();
if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
```

### 3.3 Database Schema

**`report_history` table:**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, default gen_random_uuid() |
| tenant_id | UUID | FK → tenants, NOT NULL |
| report_type | VARCHAR(50) | NOT NULL, one of: trial_balance, profit_loss, balance_sheet, cash_flow, monthly_comparison, gl_detail, journal_listing |
| period | VARCHAR(20) | e.g. "2026-03", "2026-Q1", "2026" |
| period_scope | VARCHAR(20) | monthly, quarterly, yearly, custom |
| date_from | DATE | Resolved start date |
| date_to | DATE | Resolved end date |
| filters | JSONB | {department, account, comparison, accountLevelDepth, showZeroBalance, ...} |
| pdf_storage_path | TEXT | Supabase Storage path |
| pdf_size_bytes | INTEGER | File size |
| generated_by | UUID | FK → profiles |
| locked_at | TIMESTAMP | NULL = draft, set = locked |
| locked_by | UUID | FK → profiles, NULL |
| deleted_at | TIMESTAMP | NULL = active, set = soft deleted (in trash) |
| expires_at | TIMESTAMP | Computed from retention policy at generation time |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

**Constraints:**
- Partial unique index: `UNIQUE (tenant_id, report_type, period, period_scope) WHERE locked_at IS NULL AND deleted_at IS NULL` — ensures one active draft per type+period. When a user regenerates with different filters, the existing draft is **overwritten** (UPSERT). Filters are metadata on the draft, not part of uniqueness.
- Locked versions can coexist (no unique constraint when locked_at IS NOT NULL)

**`report_retention_policy` table:**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants, UNIQUE |
| draft_retention_days | INTEGER | 30 | Min 1, max 90 |
| trash_recovery_days | INTEGER | 7 | Min 1, max 30 |
| financial_retention_value | INTEGER | 7 | |
| financial_retention_unit | VARCHAR(10) | 'years' | days, months, years |
| tax_retention_value | INTEGER | 7 | |
| tax_retention_unit | VARCHAR(10) | 'years' | |
| wht_retention_value | INTEGER | 7 | |
| wht_retention_unit | VARCHAR(10) | 'years' | |
| management_retention_value | INTEGER | 2 | |
| management_retention_unit | VARCHAR(10) | 'years' | |
| created_at | TIMESTAMP | now() | |
| updated_at | TIMESTAMP | now() | |
| updated_by | UUID | — | FK → profiles |

**Schema addition — `chart_of_accounts`:**

Add column: `cash_flow_category VARCHAR(20) NULL` — values: `operating`, `investing`, `financing`. Used by Cash Flow report. Default NULL = operating.

### 3.4 Services

```
src/lib/services/
  report-generator.ts       # Orchestrate: query data → render PDF → upload to Storage → save history
  report-pdf-templates.ts   # @react-pdf/renderer Document components per report type
  report-retention.ts       # Compute expiry dates from policy, validate retention changes
```

**`report-generator.ts` flow:**
1. Receive: `{ tenantId, reportType, period, scope, filters }`
2. Call appropriate query function to get report data
3. Render PDF using `@react-pdf/renderer` `renderToBuffer()`
4. Upload buffer to Supabase Storage bucket `report-pdfs` (private, signed URLs with 1-hour expiry for download): path `{tenantId}/{reportType}/{period}-{timestamp}.pdf`
5. Compute `expires_at` from tenant's retention policy using `REPORT_RETENTION_CATEGORY` mapping
6. Upsert into `report_history` (replace existing draft for same type+period, or create new if locked exists)
7. Return: `{ reportId, pdfUrl, metadata }`

**When retention policy is updated:** The PUT endpoint recalculates `expires_at` for all non-deleted reports in affected categories. This ensures reducing retention correctly expires old reports.

### 3.5 Database Queries

```
src/lib/db/queries/
  profit-loss.ts         # Revenue/expense aggregation by account, grouped by category
  balance-sheet.ts       # Assets/liabilities/equity snapshot at period end
  cash-flow.ts           # Indirect method: net income + adjustments + investing + financing
  journal-listing.ts     # All journal entries for period, with lines, grouped by type
  report-history.ts      # CRUD for report_history table
  report-retention.ts    # CRUD for report_retention_policy table
```

**Existing queries reused:**
- `trial-balance` route already exists — enhance with scope parameter
- `account-ledger` query logic reused for GL Detail
- `monthly-comparison` route already exists — enhance with year parameter

### 3.6 React Query Hooks

```
src/lib/hooks/
  use-trial-balance.ts       # Enhanced
  use-profit-loss.ts         # NEW
  use-balance-sheet.ts       # NEW
  use-cash-flow.ts           # NEW
  use-monthly-comparison.ts  # Enhanced
  use-gl-detail.ts           # NEW
  use-journal-listing.ts     # NEW
  use-report-history.ts      # NEW: list, lock, unlock, restore, delete mutations
  use-report-pdf.ts          # NEW: generate PDF mutation
  use-report-retention.ts    # NEW: settings CRUD
```

### 3.7 New Components

```
src/components/
  period-picker.tsx           # Monthly/Quarterly/Yearly toggle + month navigator with prev/next
  report-filter-bar.tsx       # Shared filter bar configured per report type
  report-stat-cards.tsx       # Stat card grid configured per report type
  pdf-preview-modal.tsx       # Modal: iframe PDF viewer + Lock/Download/Close
  report-history-drawer.tsx   # Side drawer: past generations list with actions
```

### 3.8 PDF Templates

All templates share a base layout:

```
<Document>
  <Page size="A4" style={styles.page}>
    {/* Company Header: name, tax ID, address */}
    {/* Report Title + Period */}
    {/* Data Table */}
    {/* Footer: page number, generated date, generated by */}
  </Page>
</Document>
```

**Font registration:** Noto Sans Thai (Regular + Bold) registered via `Font.register()` for Thai text support.

**Templates:**
- `TrialBalancePdf` — account code, name, debit, credit columns
- `ProfitLossPdf` — grouped by Revenue/Expenses with subtotals and Net Profit
- `BalanceSheetPdf` — grouped by Assets/Liabilities/Equity with equation check
- `CashFlowPdf` — Operating/Investing/Financing sections
- `MonthlyComparisonPdf` — 12 month columns + total
- `GlDetailPdf` — opening balance, transactions, closing balance per account
- `JournalListingPdf` — entries grouped by type with line details

### 3.9 Background Job

```
src/lib/inngest/
  report-cleanup.ts
```

**Schedule:** Daily at 2:00 AM (UTC+7)

**Logic:**
1. Query `report_history` where `expires_at <= NOW()` AND `deleted_at IS NULL` — LIMIT 100
2. For each: set `deleted_at = NOW()` (move to trash)
3. Join `report_history` with `report_retention_policy` per tenant: query where `deleted_at IS NOT NULL` AND `deleted_at <= NOW() - tenant.trash_recovery_days` — LIMIT 100
4. For each: delete PDF from Supabase Storage, then DELETE row from table
5. Log: `{ processed: N, trashed: N, permanently_deleted: N }`

Note: Step 3 joins with each tenant's retention policy to get the correct `trash_recovery_days` (it's per-tenant, not global).

---

## 4. Sidebar Navigation Update

Current sidebar already has the REPORTS group with 3 links. Update to match new routes:

```typescript
{
  label: "REPORTS",
  items: [
    { href: "/reports/financial", label: "Financial Statements", icon: BarChart3 },
    { href: "/reports/tax", label: "Tax Reports", icon: ClipboardList },      // Phase 4B
    { href: "/reports/wht", label: "WHT Certificates", icon: FileCheck },     // Phase 4C
  ],
}
```

No change needed — the sidebar links already point to `/reports/financial` which is the hub page.

---

## 5. Data Flow

### 5.1 View Report (Screen)

```
User selects period → React Query hook fetches data from API →
API queries journal_lines + chart_of_accounts → aggregates by report type →
Returns JSON → Page renders stat cards + data table
```

### 5.2 Generate PDF

```
User clicks "Generate PDF" → POST /api/.../generate-pdf →
Server queries same data → Renders @react-pdf/renderer template →
Uploads PDF buffer to Supabase Storage →
Upserts report_history row (replace draft or create alongside locked) →
Returns { reportId, pdfUrl } → Modal opens with iframe preview
```

### 5.3 Lock Report

```
User clicks "Lock as Official" in modal or history drawer →
PATCH /api/.../history/{id} { action: "lock" } →
Sets locked_at + locked_by → Returns updated record →
UI shows locked badge, subsequent generate creates new draft
```

### 5.4 Retention & Cleanup

```
Daily cron → Query expired reports → Soft delete (set deleted_at) →
Query reports past trash recovery → Delete from Storage + DELETE row →
Users see "Expiring" badge 30 days before expiry →
Users can restore from trash within recovery period
```

---

## 6. Settings Page Addition

Add "Report Retention" to the accounting settings layout:

```
/settings/accounting/report-retention
```

This is a new settings sub-page alongside existing stubs (bank-recon, period-locks, tax-reports, templates).

---

## 7. Additional Specifications

### 7.1 Supabase Storage Configuration

- **Bucket name:** `report-pdfs`
- **Access:** Private (no public URLs)
- **Download:** Signed URLs with 1-hour expiry, generated on demand when user clicks Download or views in iframe
- **Path format:** `{tenantId}/{reportType}/{period}-{timestamp}.pdf`
- **RLS:** Tenant-scoped — users can only access PDFs belonging to their tenant

### 7.2 Export Button Behavior

The "Export" button on each report page exports the **screen data** (not PDF) as Excel (.xlsx):
- Uses client-side export similar to existing `csv-export.ts` but extended for Excel format
- Includes: report title, period, filters used, data table with formatting
- Separate from "Generate PDF" which creates the formal document

### 7.3 Pagination for Large Reports

- **GL Detail and Journal Listing:** Paginated (50 rows per page) with `<Pagination>` component, matching Phase 3 pattern
- **Financial Statements (Trial Balance, P&L, Balance Sheet, Cash Flow):** Not paginated — these are summary reports with limited rows (typically < 100 accounts)
- **Monthly Comparison:** Not paginated — 12 columns, limited rows
- **PDF generation:** Always includes all data regardless of pagination (full report)

### 7.4 Expiring Badge Threshold

- Reports show "Expiring" badge when `expires_at <= NOW() + 30 days` AND `expires_at > NOW()`
- Exception: if the total retention period is less than 30 days (e.g. draft with 7-day retention), show "Expiring" badge at 50% of remaining time instead
- Badge appears in: report history drawer, report hub cards (if any report is expiring)

### 7.5 Role-Based Access

| Action | admin | maker | checker | viewer |
|--------|:---:|:---:|:---:|:---:|
| View reports (screen) | Y | Y | Y | Y |
| Export Excel | Y | Y | Y | Y |
| Generate PDF | Y | Y | Y | — |
| Lock/Unlock reports | Y | — | Y | — |
| Delete reports | Y | — | — | — |
| Modify retention settings | Y | — | — | — |
| Restore from trash | Y | — | — | — |

### 7.6 Loading & Empty States

- **Loading:** Skeleton components matching Phase 3 pattern — skeleton stat cards (4 rects), skeleton filter row, skeleton table rows
- **Empty state:** `<EmptyState>` component with message per report type, e.g. "No journal entries found for March 2026. Post journal entries first to generate this report."
- **Hub cards:** Show "Last generated: 25 Mar 2026" or "Never generated" subtitle

### 7.7 Settings Navigation Update

Add "Report Retention" entry to the accounting settings layout at `src/app/(app)/settings/layout.tsx`:
```
{ href: "/settings/accounting/report-retention", label: "Report Retention", icon: Clock }
```

### 7.8 Period Validation

The `period` column format must match `period_scope`:
- `monthly` → `YYYY-MM` (e.g. "2026-03")
- `quarterly` → `YYYY-QN` (e.g. "2026-Q1")
- `yearly` → `YYYY` (e.g. "2026")
- `custom` → `YYYY-MM-DD_YYYY-MM-DD` (e.g. "2026-03-10_2026-03-25")

Validated in `report-generator.ts` before insert. `date_from` and `date_to` are always resolved regardless of scope.

### 7.9 Monthly Comparison — Partial Year

When generating for a partial year (e.g. March 2026 = 3 months elapsed):
- Show columns for all elapsed months (Jan, Feb, Mar) with actual data
- Future months (Apr–Dec) show "—" (dash), not zero
- YTD column shows sum of elapsed months only

---

## 8. Error Handling

- **PDF generation failure:** Show toast with retry option, don't save partial history
- **Storage upload failure:** Retry once, then show error with "Try Again" button
- **Concurrent lock conflict:** If two users try to lock the same draft, second gets "Already locked by [name]"
- **Retention policy update:** Validate all fields before submit, show affected count in confirmation
- **Expired report access:** Show "This report has expired and moved to Trash" with restore option if within recovery period

---

## 9. Scope Exclusions

The following are NOT in Phase 4A:
- Tax reports (ภ.พ.30, ภ.ง.ด. series) — Phase 4B
- WHT certificates (50 ทวิ PDF) — Phase 4C
- Budget vs Actual report — requires budget module (future)
- Department P&L — can be added later as a filter extension
- Customer/Vendor statements — future phase
- Report email/sharing — future phase
