# Phase 3: Accounting Modules — Design Spec

**Date:** 2026-03-23
**Branch:** feature/app-v2
**Status:** Approved
**Mockups:** `.superpowers/brainstorm/45399-1774208299/`

---

## Overview

Phase 3 adds four accounting module pages to AICount: General Ledger, Accounts Receivable, Accounts Payable, and Bank Reconciliation. These pages provide the "accounting view" of data that already flows through the document pipeline (OCR → Extraction → Approval → Auto-posting), plus manual adjustment capabilities.

### Design Approach: Document-Driven with Manual Adjustment

- Journal entries are **auto-generated** when documents are approved via `tax-gl-mapping.ts`
- Auto-generated entries are **editable** (accountant can adjust GL account, amount, department)
- **Manual journal entries** can be created directly for adjustments, accruals, corrections
- AR/AP views are **derived from documents** with payment tracking (not journal lines — documents are the source of truth for invoices)
- Period lock enforcement — no edits to entries in locked periods
- All changes logged to `auditLogs`

### Priority Order

1. General Ledger (highest — foundation for everything)
2. Accounts Receivable
3. Accounts Payable
4. Bank Reconciliation (lowest — minimal scope)

---

## 1. General Ledger Page (`/ledger`)

### Layout

- Page header: title "General Ledger" + Thai subtitle "สมุดบัญชีแยกประเภท"
- 4 stat cards: Entries This Month, Drafts Pending, Total Debits, Total Credits (with balanced indicator)
- Two-tab layout: Journal Entries | Account Ledger
- "New Journal Entry" primary button in header
- "Export" secondary button

### Tab 1: Journal Entries

**Toolbar filters:**
- Date range picker (default: current month)
- Type dropdown: All / RV / SV / PurV / JV / Manual
- Status filter pills: All (default) | Posted | Draft | Reversed
- Search input (searches description text)

**DataTable columns:**
| Column | Width | Alignment | Notes |
|--------|-------|-----------|-------|
| Date | 11% | Left | Format: `DD MMM YYYY` |
| JV No. | 13% | Left | Monospace, e.g. `JV-2026-0142` |
| Type | 7% | Left | Color-coded badge: PurV (blue), RV (green), SV (purple), JV (amber), Manual (gray) |
| Description | 30% | Left | Thai text + optional English subtitle |
| Debit | 12% | Right | `tabular-nums`, monospace |
| Credit | 12% | Right | `tabular-nums`, monospace |
| Status | 8% | Center | Badge: Posted (green), Draft (amber), Reversed (red) |
| Source | 5% | Center | Document link with icon, or dash |
| Actions | 4% | Center | Edit pencil icon button |

**Row expansion:**
- Click row → expands inline showing journal lines sub-table
- Sub-table columns: Account Code (monospace, blue link), Account Name, Department (badge), Description, Debit, Credit
- Footer row: Total Debit, Total Credit, Difference (green checkmark if zero, red if mismatch)

**Row states:**
- Reversed entries: 55% opacity, description strikethrough, "Reversed on [date]" subtitle, disabled edit button
- Draft entries: normal display, editable
- Posted entries: normal display, editable (unless period-locked)
- Period-locked entries: edit button disabled with tooltip "Period locked"

**Pagination:** 20 entries per page, standard prev/next with page numbers

### Tab 2: Account Ledger

**Controls:**
- Account selector: searchable dropdown from COA, grouped by category (Asset/Liability/Equity/Revenue/Expense). Shows: account code (monospace, bold) + account name + category badge
- Date range picker (same as Tab 1)

**Layout:**
- Opening balance banner (blue background): "Opening Balance — [start date]" with amount and Dr/Cr indicator
- Transaction table
- Summary footer: Period Debits, Period Credits, Net Movement
- Closing balance banner (green background): "Closing Balance — [end date]" with amount

**DataTable columns:**
| Column | Width | Alignment | Notes |
|--------|-------|-----------|-------|
| Date | 12% | Left | |
| JV No. | 14% | Left | Clickable link → switches to Journal Entries tab with that entry expanded |
| Description | 36% | Left | |
| Debit | 13% | Right | `tabular-nums` |
| Credit | 13% | Right | Credit amounts in red weight |
| Balance | 14% | Right | Running balance, bold |

### Manual JV Creation/Edit Modal

**Header section:**
- Date picker (required)
- Description / memo text input (required)

**Line items table:**
- Editable rows with: Account (searchable COA dropdown), Department (optional dropdown), Debit, Credit, Line description
- "Add Row" button below table
- Delete row icon per row

**Footer:**
- Total Debit, Total Credit, Difference (highlighted red if non-zero)
- "Save as Draft" secondary button
- "Post" primary button (disabled until debits = credits)
- "Cancel" button

**Edit mode (existing entry):**
- Same modal, pre-filled with current values
- Shows source document link if entry was auto-generated
- "Save Changes" replaces "Post" button
- Changes logged to auditLogs with before/after values

### Data Sources

- **Existing table:** `journalLines` (documentId, accountCode, deptCode, debit, credit, description)
- **Existing service:** `tax-gl-mapping.ts` for auto-posting from approved documents
- **Existing API:** `/api/tenants/[id]/reports/trial-balance`
- **New API needed:** `/api/tenants/[id]/journal-entries` (CRUD + pagination + filtering)
- **New API needed:** `/api/tenants/[id]/account-ledger` (filtered by account + date range with running balance)
- **New hook:** `use-journal-entries.ts` (React Query)
- **New hook:** `use-account-ledger.ts` (React Query)

---

## 2. Accounts Receivable Page (`/receivables`)

### Layout

- Page header: title "Accounts Receivable" + Thai subtitle "ลูกหนี้การค้า"
- 4 stat cards with left-border accents
- Filter toolbar
- Aging table with expandable customer rows
- "Export" button in header

### Stat Cards

| Card | Accent | Value Source |
|------|--------|-------------|
| Total Outstanding | none | Sum of unpaid customer invoices |
| Overdue | red (left border) | Count + amount of invoices past due date |
| Collected This Month | green (left border) | Payments received in current period |
| Avg Collection Days | none | Weighted average days to payment, compared to credit terms |

### Toolbar

- Date range picker
- Search input (customer name)
- Status filter pills: All | Open | Overdue | Partial | Paid
- Export CSV button

### Aging Table

**Columns:**
| Column | Width | Alignment | Notes |
|--------|-------|-----------|-------|
| Customer | 28% | Left | Customer name (bold) + Tax ID (subtitle, monospace) + aging mini-bar on expanded rows |
| Current | 10% | Right | `tabular-nums` |
| 1–30 d | 10% | Right | |
| 31–60 d | 10% | Right | Amber color when non-zero |
| 61–90 d | 10% | Right | Orange color when non-zero |
| 90+ d | 10% | Right | Red color when non-zero |
| Total | 12% | Right | Bold |
| Expand | 4% | Center | Arrow indicator |

**Aging color gradient:**
- Current, 1–30: default text color (#374151)
- 31–60: amber (#d97706), bold
- 61–90: orange (#ea580c), bold
- 90+: red (#dc2626), bold

**Aging mini-bar:** Visual horizontal bar showing proportion of aging buckets (green → yellow → orange → red). Displayed on expanded customer rows.

**Footer row:** Column totals for all aging buckets

### Expanded Customer Detail (Invoice List)

**Sub-table columns:**
| Column | Alignment | Notes |
|--------|-----------|-------|
| Invoice | Left | Monospace, e.g. `INV-2026-0045` |
| Date | Left | Invoice date |
| Due Date | Left | Color-coded: overdue = red bold, due soon = amber, ok = default |
| Amount | Right | Original invoice amount |
| Paid | Right | Green when > 0 |
| Remaining | Right | Red when overdue, bold |
| Status | Center | Badge: Open (green), Partial (blue), Overdue (red with days count), Paid (green) |
| Source | Center | Document link |
| Action | Center | "Record Payment" button |

**Overdue badges show days overdue** for actionable context (e.g., "Overdue 37d").

### Payment Recording Modal

**Invoice summary section** (read-only, gray background):
- Invoice number, outstanding amount (red), customer name, overdue days

**Form fields:**
- Payment Amount (required): Currency input with ฿ prefix, pre-filled with full remaining amount. Helper text: "Adjust for partial payment."
- Payment Date (required): Date picker, defaults to today
- Payment Method: Dropdown — Bank Transfer, Cheque, Cash, PromptPay
- Reference No.: Text input (transfer ref, cheque number)
- Notes: Optional text input

**Actions:** Cancel, Record Payment (primary)

### Data Sources

- **Existing API:** `/api/tenants/[id]/reports/aging` (needs enhancement for per-customer breakdown)
- **Existing table:** `documents` filtered by direction=receivable + `payments` for status
- **Existing table:** `customers`
- **New API needed:** `/api/tenants/[id]/receivables` (aging by customer with invoice breakdown)
- **New API needed:** `POST /api/tenants/[id]/payments` (record payment, creates offsetting journal entry)
- **New hook:** `use-receivables.ts` (React Query)

---

## 3. Accounts Payable Page (`/payables`)

### Layout

Symmetrical to AR page with vendor-specific additions.

### Stat Cards

| Card | Accent | Value Source |
|------|--------|-------------|
| Total Payables | none | Sum of unpaid vendor invoices |
| Due This Week | amber (left border) | Upcoming payments within 7 days |
| Paid This Month | green (left border) | Payments made in current period |
| Top Vendor | none | Vendor with largest outstanding balance |

### Aging Table

Same structure as AR but with vendor data:
- **Vendor Name** (bold) + Tax ID (subtitle)
- Same aging columns and color gradient
- Same expand/collapse pattern

### Expanded Vendor Detail

Same as AR invoice detail with one addition:
- **WHT indicator column:** Shows if vendor has a default WHT rate (from vendor master data)
- WHT rate badge next to vendor name when applicable (e.g., "WHT 3%")

### Payment Recording Modal

Same as AR modal with one addition:
- **WHT Deduction field:** Auto-calculated from vendor's default WHT rate
- Shows: Gross Amount, WHT Amount (auto-calculated), Net Payment
- WHT amount is editable (override auto-calculation)
- Recording a payment with WHT creates two journal entries: payment + WHT payable

### Data Sources

- **Existing API:** `/api/tenants/[id]/reports/aging` (needs enhancement for per-vendor breakdown)
- **Existing table:** `documents` filtered by direction=payable + `payments` for status
- **Existing table:** `vendors` (includes defaultWhtRate)
- **New API needed:** `/api/tenants/[id]/payables` (aging by vendor with invoice breakdown)
- **Reuse:** `POST /api/tenants/[id]/payments` (same endpoint, direction parameter)
- **New hook:** `use-payables.ts` (React Query)

---

## 4. Bank Reconciliation Page (`/bank-recon`) — Minimal Scope

### Layout

- Page header: title "Bank Reconciliation" + Thai subtitle "กระทบยอดธนาคาร"
- Summary bar: Statement Balance, GL Balance, Difference (highlighted if non-zero)
- Split view: Bank Statement (left panel) vs Unmatched GL Entries (right panel)

### Left Panel: Bank Statement Transactions

- Upload bank statement (CSV/OFX) or select from existing statements
- Date range filter
- Transaction list: Date, Description, Debit, Credit, Status (Matched/Unmatched)
- Matched items shown with reduced opacity and match indicator

### Right Panel: Unmatched GL Entries

- Filtered to bank-related GL accounts (e.g., 1102 - ธนาคาร)
- Same columns: Date, JV No., Description, Debit, Credit
- Only shows unmatched entries

### Matching

- **Auto-match:** System suggests matches based on amount + date proximity (±3 days)
- Auto-matched pairs shown with confidence indicator and "Confirm" button
- **Manual match:** Click a bank transaction, then click a GL entry to pair them
- **Bulk confirm:** "Confirm All Matches" button for auto-matched pairs above confidence threshold

### Summary Bar

- Statement closing balance
- GL closing balance (for selected bank account)
- Reconciling items count
- Unreconciled difference (red if non-zero, green checkmark if zero)

### Data Sources

- **Existing API:** `/api/tenants/[id]/bank-recon` (needs rewrite to match against GL entries, not documents)
- **Existing API:** `/api/tenants/[id]/bank-statements` (fix: error.message leak to client — log server-side, return generic message)
- **Existing table:** `bankStatements` (normalize JSONB lineItems → new `bankTransactions` table)
- **New table:** `bankTransactions` (normalized from JSONB)
- **New table:** `bankReconMatches` (persisted match state)
- **New hook:** `use-bank-recon.ts` (React Query)

---

## Shared Patterns

### Components to Reuse (from Phase 1/2)

- `DataTable` with `onRowClick` for expand/collapse
- `Tabs` for GL tab switching
- `StatCard` with `href` for summary cards
- `Badge` / `StatusBadge` for type and status indicators
- `Modal` for JV creation and payment recording
- `Select` for dropdowns (COA selector, department, payment method)
- `Input` for form fields
- `Button` for actions
- `Pagination` for table pagination
- `Skeleton` for loading states
- `EmptyState` for no-data views
- `Toast` via `useToast()` for success/error feedback
- `Breadcrumbs` for navigation context

### New Components Needed

- **AgingMiniBar** — horizontal stacked bar showing aging bucket proportions (green → yellow → orange → red). Used in AR/AP expanded rows. Simple div with colored segments.
- **CurrencyInput** — Input with currency prefix (฿), auto-formatting with thousand separators, `tabular-nums`
- **AccountSelect** — Searchable dropdown for COA, grouped by category, showing code + name + category badge
- **JournalLineEditor** — Editable table for adding/removing journal entry lines with running totals

### Design Tokens

All pages use the existing CSS variable system from `globals.css`. No new tokens needed. Color mapping for type badges:

| Type | Background | Text |
|------|-----------|------|
| PurV | `#eff6ff` | `#1d4ed8` |
| RV | `#f0fdf4` | `#15803d` |
| SV | `#faf5ff` | `#7c3aed` |
| JV | `#fefce8` | `#a16207` |
| Manual | `#f1f5f9` | `#475569` |

### API Auth Pattern

All new API routes follow the existing pattern:
```tsx
const ctx = getRequestContext(request);
if (!ctx) return unauthorized();
if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");
```

### Period Lock Enforcement

- Check `periodLocks` table before allowing edits
- Locked periods: edit button disabled with tooltip
- Manual JV creation: date picker restricts to unlocked periods
- Payment recording: validates payment date is in unlocked period

### Sidebar Navigation

Add new items to the existing sidebar under "Accounting" group:
- General Ledger (`/ledger`)
- Receivables (`/receivables`)
- Payables (`/payables`)
- Bank Recon (`/bank-recon`)

---

## Schema Changes

### New Table: `journalEntries` (REQUIRED)

Header table that groups `journalLines` and tracks entry-level metadata. Required for manual JVs (which have no source document) and for entry-level status/numbering.

```
journalEntries:
  id              UUID PRIMARY KEY
  tenantId        UUID NOT NULL → tenants.id
  jvNumber        TEXT NOT NULL        -- e.g. "JV-2026-0142", tenant-scoped
  date            DATE NOT NULL
  type            journalTypeEnum      -- RV, SV, PV, PurV, JV, Manual
  description     TEXT NOT NULL
  status          journalStatusEnum    -- draft, posted, reversed
  sourceDocumentId UUID NULL → documents.id  -- NULL for manual entries
  reversedFromId  UUID NULL → journalEntries.id  -- links reversal to original
  createdBy       UUID NOT NULL → profiles.id
  createdAt       TIMESTAMPTZ DEFAULT now()
  updatedAt       TIMESTAMPTZ DEFAULT now()

  UNIQUE (tenantId, jvNumber)
  INDEX (tenantId, date)
  INDEX (tenantId, status)
  INDEX (sourceDocumentId)
```

### New Enum: `journalStatusEnum`

Values: `draft`, `posted`, `reversed`

**State machine:**
```
draft → posted    (user posts entry)
draft → deleted   (soft delete, not a status — just deletedAt timestamp)
posted → reversed (creates a new reversal entry with reversed debits/credits)
```
- Reversed entries cannot be re-posted or edited
- Auto-generated entries from voided documents are auto-reversed (new reversal entry created)
- Draft entries can be edited freely
- Posted entries can be edited only in unlocked periods (creates audit log)

### Enum Update: `journalTypeEnum`

Add `Manual` to existing enum: `["RV", "SV", "PV", "PurV", "JV", "Manual"]`

Note: `PV` (Payment Voucher) remains in the enum for legacy data. The GL type filter dropdown shows all types including PV.

### Migration: `journalLines` changes

- Add `journalEntryId UUID NOT NULL → journalEntries.id`
- Change `documentId` to **nullable** (manual entries have no document)
- Backfill: Create `journalEntries` header rows for all existing `journalLines` groups (grouped by documentId), then populate `journalEntryId`

### New Table: `payments`

Tracks payments against documents (invoices) for AR/AP.

```
payments:
  id              UUID PRIMARY KEY
  tenantId        UUID NOT NULL → tenants.id
  documentId      UUID NOT NULL → documents.id  -- the invoice being paid
  journalEntryId  UUID NULL → journalEntries.id  -- the offsetting JE created
  amount          DECIMAL(15,2) NOT NULL
  whtAmount       DECIMAL(15,2) DEFAULT 0  -- WHT deduction (AP only)
  netAmount       DECIMAL(15,2) NOT NULL    -- amount - whtAmount
  paymentDate     DATE NOT NULL
  paymentMethod   TEXT NOT NULL             -- bank_transfer, cheque, cash, promptpay
  referenceNo     TEXT NULL
  notes           TEXT NULL
  createdBy       UUID NOT NULL → profiles.id
  createdAt       TIMESTAMPTZ DEFAULT now()

  INDEX (tenantId, documentId)
  INDEX (tenantId, paymentDate)
```

### Column Addition: `documents.dueDate`

- Add `dueDate DATE NULL` to `documents` table
- Auto-calculated: `documentDate + customer.creditTermDays` (for AR) or `documentDate + vendor payment terms` (for AP)
- Can be manually overridden during extraction
- Used for aging calculations (overdue = `dueDate < today AND status != paid`)

### AR/AP Payment Status (computed, not stored)

Payment status is derived at query time:
- **Open**: No payments recorded, not overdue
- **Partial**: Sum of `payments.amount` < `documents.grandTotal`
- **Paid**: Sum of `payments.amount` >= `documents.grandTotal`
- **Overdue**: `dueDate < today` AND status is Open or Partial

### JV Number Generation Strategy

Tenant-scoped sequential counter:
- Format: `JV-{YYYY}-{NNNN}` (zero-padded 4 digits, e.g. `JV-2026-0142`)
- Storage: `nextJvSequence INT` column on `tenants` table (or separate `sequences` table)
- Generation: `UPDATE tenants SET nextJvSequence = nextJvSequence + 1 ... RETURNING nextJvSequence` inside a transaction for concurrency safety
- Resets annually (or continues — configurable per tenant in settings)

### Bank Reconciliation Tables (Minimal)

```
bankTransactions:
  id              UUID PRIMARY KEY
  bankStatementId UUID NOT NULL → bankStatements.id
  transactionDate DATE NOT NULL
  description     TEXT NOT NULL
  debit           DECIMAL(15,2) DEFAULT 0
  credit          DECIMAL(15,2) DEFAULT 0
  referenceNo     TEXT NULL
  createdAt       TIMESTAMPTZ DEFAULT now()

  INDEX (bankStatementId)

bankReconMatches:
  id                UUID PRIMARY KEY
  tenantId          UUID NOT NULL → tenants.id
  bankTransactionId UUID NOT NULL → bankTransactions.id
  journalEntryId    UUID NOT NULL → journalEntries.id
  matchType         TEXT NOT NULL  -- auto, manual
  confidence        DECIMAL(3,2) NULL  -- 0.00–1.00 for auto matches
  confirmedAt       TIMESTAMPTZ NULL
  confirmedBy       UUID NULL → profiles.id
  createdAt         TIMESTAMPTZ DEFAULT now()

  UNIQUE (bankTransactionId)
  INDEX (tenantId, confirmedAt)
```

Migration: Normalize existing `bankStatements.lineItems` JSONB into `bankTransactions` rows.

### Existing Tables (No Changes)

- `chartOfAccounts` — COA for account selectors
- `vendors` — vendor data with WHT rates
- `customers` — customer data with credit terms
- `periodLocks` — period lock enforcement
- `auditLogs` — change tracking

---

## Error Handling

All pages follow the same error handling patterns:

- **API fetch errors:** React Query handles retries (3 attempts). On failure, show inline error state with "Retry" button using existing `EmptyState` component with error variant.
- **Form submission errors:**
  - Validation errors (debit ≠ credit, missing required fields): inline red text below the field
  - Period lock violation: Toast error "Cannot modify entries in locked period (YYYY-MM)"
  - Server errors: Toast error with generic message, detailed error logged server-side
- **Optimistic updates:** Payment recording and JV posting use optimistic UI (update table immediately, rollback on error)
- **Unsaved changes:** JV creation/edit modal shows confirmation dialog on dismiss if form is dirty

---

## Loading States

- **GL page:** 4 skeleton stat cards (pulse animation) + table skeleton with 8 rows
- **AR/AP pages:** 4 skeleton stat cards + table skeleton with 6 rows (wider cells for aging columns)
- **Bank Recon:** 2-panel skeleton with 5 rows each + summary bar skeleton
- **Modals:** Button shows spinner during submission (existing `loading-buttons` pattern)
- All loading states use the existing `Skeleton` component

---

## Responsive Design

### Mobile (< 768px)

- **GL Journal Entries:** Hide Type and Source columns. Debit/Credit collapse into single "Amount" column with Dr/Cr text indicator. Row expansion shows a card layout instead of sub-table.
- **GL Account Ledger:** Same column reduction. Opening/closing balance banners stack vertically.
- **AR/AP Aging:** Collapse aging buckets — show only "Current", "Overdue", and "Total" columns. Full aging visible in expanded row detail.
- **Bank Recon:** Stack panels vertically (bank statement on top, GL entries below) instead of side-by-side.
- **Stat cards:** 2×2 grid on tablet, single column on mobile.
- **Modals:** Full-screen on mobile with sticky footer buttons.

### Tablet (768px–1024px)

- All columns visible but with tighter padding
- Stat cards in 2×2 grid

---

## DataTable Expansion

The existing `DataTable` component needs an `expandedRow` render prop to support inline expansion:

```tsx
<DataTable
  data={entries}
  columns={columns}
  expandedRow={(row) => <JournalLinesDetail entry={row} />}
  onRowClick={(row) => toggleExpand(row.id)}
/>
```

This is a non-trivial enhancement to `DataTable`. Implementation should add:
- `expandedRowIds` state (Set of expanded row IDs)
- `expandedRow` render prop receiving the row data
- Smooth expand/collapse animation (max-height transition, 200ms)
- Only one row expanded at a time (optional, configurable)

---

## Export

- **Format:** CSV download of currently filtered/visible data
- **GL Export:** All visible columns including expanded journal lines (one row per line)
- **AR/AP Export:** Customer/vendor aging summary + invoice detail
- **Implementation:** Client-side CSV generation from React Query cached data, triggered by Export button. No server-side export endpoint needed for v1.
- Does NOT reuse the existing Express template export system (that's for document export to Express Accounting)

---

## Keyboard & Accessibility

### JV Creation Modal

- `Tab` navigates between cells in the line items table
- `Enter` on the last row adds a new row
- `Escape` closes the modal (with unsaved changes confirmation)
- `Ctrl+Enter` / `Cmd+Enter` submits the form

### Tables

- All interactive rows are keyboard-focusable
- `Enter` or `Space` expands/collapses a row
- Focus ring visible on all interactive elements (existing CSS handles this)

### Screen Reader

- Stat cards use `aria-label` with full context (e.g., "Total Outstanding: 1,245,800 Baht, 32 invoices")
- Aging table uses `aria-sort` on sortable columns
- Status badges use `aria-label` (e.g., "Overdue 37 days")

---

## Design Tokens

All pages use the existing CSS variable system from `globals.css`. New CSS variables needed for type badges and aging colors (added to `@theme inline`):

```css
/* Journal type badge colors */
--badge-purv-bg: #eff6ff;   /* maps to blue-50 */
--badge-purv-text: #1d4ed8; /* maps to blue-700 */
--badge-rv-bg: #f0fdf4;     /* maps to green-50 */
--badge-rv-text: #15803d;   /* maps to green-700 */
--badge-sv-bg: #faf5ff;     /* maps to purple-50 */
--badge-sv-text: #7c3aed;   /* maps to purple-600 */
--badge-jv-bg: #fefce8;     /* maps to yellow-50 */
--badge-jv-text: #a16207;   /* maps to yellow-700 */
--badge-manual-bg: #f1f5f9; /* maps to slate-100 */
--badge-manual-text: #475569; /* maps to slate-600 */

/* Aging gradient colors */
--aging-current: var(--color-foreground);
--aging-30: var(--color-foreground);
--aging-60: #d97706;  /* amber-600 */
--aging-90: #ea580c;  /* orange-600 */
--aging-overdue: var(--color-destructive);
```

---

## Out of Scope

- Complex payment matching (multi-invoice to single payment)
- Credit note management
- Automatic bank feed integration (only manual CSV/OFX upload)
- Multi-currency support
- Intercompany transactions
- Batch posting of draft entries (single-entry posting only for v1)
- Advanced keyboard shortcuts beyond basic navigation
