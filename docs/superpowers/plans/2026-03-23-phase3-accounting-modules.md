# Phase 3: Accounting Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add General Ledger, Accounts Receivable, Accounts Payable, and Bank Reconciliation pages to AICount.

**Architecture:** Document-driven accounting — journal entries auto-generated from approved documents via `tax-gl-mapping.ts`, with manual JV creation for adjustments. AR/AP derived from documents + payments table. All pages follow the existing Phase 1/2 design patterns (stat cards, DataTable, modals, React Query hooks).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Drizzle ORM, Supabase, React Query, Zustand, Zod v4, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-23-phase3-accounting-modules-design.md`
**Mockups:** `.superpowers/brainstorm/45399-1774208299/` (gl-ledger-v2.html, ar-receivables-v2.html)

---

## File Map

### Schema & Migrations

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/db/schema.ts` | Add `journalStatusEnum`, `Manual` to `journalTypeEnum`, `journalEntries` table, `payments` table, `bankTransactions` table, `bankReconMatches` table, `dueDate` to documents, `nextJvSequence` to tenants, nullable `documentId` on journalLines, add `journalEntryId` FK |
| Modify | `src/lib/db/relations.ts` | Add relations for new tables |
| Create | `supabase/migrations/NNNN_*.sql` | Drizzle-generated migration (auto-named by `drizzle-kit generate`) |

### Design Tokens

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/app/globals.css` | Add badge and aging CSS variables to `@theme inline` |

### Shared Components

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/components/data-table.tsx` | Add `expandedRow` render prop and expand/collapse state |
| Create | `src/components/currency-input.tsx` | Currency input with ฿ prefix, thousand separators |
| Create | `src/components/account-select.tsx` | Searchable COA dropdown grouped by category |
| Create | `src/components/journal-line-editor.tsx` | Editable journal lines table with running totals |
| Create | `src/components/aging-mini-bar.tsx` | Horizontal stacked aging bar |
| Modify | `src/components/sidebar.tsx` | Add Accounting nav group (GL, AR, AP, Bank Recon) |

### API Routes

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/app/api/tenants/[id]/journal-entries/route.ts` | GET (list + filter + paginate), POST (create JV) |
| Create | `src/app/api/tenants/[id]/journal-entries/[entryId]/route.ts` | GET (single), PUT (edit), POST /post (change status) |
| Create | `src/app/api/tenants/[id]/account-ledger/route.ts` | GET (account transactions + running balance) |
| Create | `src/app/api/tenants/[id]/receivables/route.ts` | GET (aging by customer + invoice breakdown) |
| Create | `src/app/api/tenants/[id]/payables/route.ts` | GET (aging by vendor + invoice breakdown) |
| Create | `src/app/api/tenants/[id]/payments/route.ts` | POST (record payment, create offsetting JE) |
| Modify | `src/app/api/tenants/[id]/bank-recon/route.ts` | Rewrite to match GL entries, not documents |
| Modify | `src/app/api/tenants/[id]/bank-statements/route.ts` | Fix error.message leak |
| Create | `src/app/api/tenants/[id]/bank-recon/matches/route.ts` | POST (confirm match), DELETE (unmatch) |

### React Query Hooks

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/hooks/use-journal-entries.ts` | Fetch, create, edit, post, reverse journal entries |
| Create | `src/lib/hooks/use-account-ledger.ts` | Fetch account transactions with running balance |
| Create | `src/lib/hooks/use-receivables.ts` | Fetch AR aging + invoice detail + stats |
| Create | `src/lib/hooks/use-payables.ts` | Fetch AP aging + invoice detail + stats |
| Create | `src/lib/hooks/use-payments.ts` | Record payments mutation |
| Create | `src/lib/hooks/use-bank-recon.ts` | Fetch bank recon data + match mutations |

### Pages

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/app/(app)/ledger/page.tsx` | General Ledger (Journal Entries + Account Ledger tabs) |
| Create | `src/app/(app)/receivables/page.tsx` | Accounts Receivable |
| Create | `src/app/(app)/payables/page.tsx` | Accounts Payable |
| Create | `src/app/(app)/bank-recon/page.tsx` | Bank Reconciliation |

### Types & Validation

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/types/domain.ts` | Add `JournalEntry`, `Payment`, `BankTransaction`, `BankReconMatch` type exports |
| Modify | `src/types/api.ts` | Add API response types for journal entries, aging, payments |

### Services

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/services/jv-number.ts` | Tenant-scoped JV number generation |
| Create | `src/lib/services/payment-status.ts` | Compute payment status from documents + payments |
| Create | `src/lib/services/aging.ts` | Aging bucket calculation (overdue-based) |
| Create | `src/lib/services/bank-matching.ts` | Auto-match bank transactions to GL entries |
| Create | `src/lib/utils/csv-export.ts` | Client-side CSV generation utility ("use client") |
| Modify | `src/lib/services/tax-gl-mapping.ts` | Update to create `journalEntries` header alongside `journalLines` |

### Database Queries

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/db/queries/journal-entries.ts` | Journal entry CRUD, pagination, filtering |
| Create | `src/lib/db/queries/account-ledger.ts` | Account transactions with running balance |
| Create | `src/lib/db/queries/receivables.ts` | AR aging aggregation by customer |
| Create | `src/lib/db/queries/payables.ts` | AP aging aggregation by vendor |
| Create | `src/lib/db/queries/payments.ts` | Payment CRUD + sum queries |
| Create | `src/lib/db/queries/bank-recon.ts` | Bank transaction + match queries |

---

## Task 1: Schema Migration — Foundation Tables

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/relations.ts`
- Modify: `src/types/domain.ts`
- Modify: `src/types/api.ts`
- Create: `supabase/migrations/NNNN_*.sql` (auto-named by drizzle-kit)

- [ ] **Step 1: Add enums and journalEntries table to schema.ts**

Add after existing enums (~line 55):

```typescript
export const journalStatusEnum = pgEnum("journal_status", [
  "draft",
  "posted",
  "reversed",
]);
```

Update existing `journalTypeEnum` to include `"Manual"`:
```typescript
// Find the existing journalTypeEnum and add "Manual" to the array
```

Add `journalEntries` table after existing tables:

```typescript
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  jvNumber: text("jv_number").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  type: journalTypeEnum("type").notNull(),
  description: text("description").notNull(),
  status: journalStatusEnum("status").notNull().default("draft"),
  sourceDocumentId: uuid("source_document_id").references(() => documents.id),
  reversedFromId: uuid("reversed_from_id"),  // self-reference added after table
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("journal_entries_tenant_jv_unique").on(table.tenantId, table.jvNumber),
  index("journal_entries_tenant_date_idx").on(table.tenantId, table.date),
  index("journal_entries_tenant_status_idx").on(table.tenantId, table.status),
  index("journal_entries_source_doc_idx").on(table.sourceDocumentId),
]);
```

- [ ] **Step 2: Add payments table to schema.ts**

```typescript
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  whtAmount: numeric("wht_amount", { precision: 15, scale: 2 }).default("0"),
  netAmount: numeric("net_amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: date("payment_date", { mode: "string" }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  referenceNo: text("reference_no"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("payments_tenant_doc_idx").on(table.tenantId, table.documentId),
  index("payments_tenant_date_idx").on(table.tenantId, table.paymentDate),
]);
```

- [ ] **Step 3: Add bank tables to schema.ts**

```typescript
export const bankTransactions = pgTable("bank_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankStatementId: uuid("bank_statement_id").notNull().references(() => bankStatements.id),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  debit: numeric("debit", { precision: 15, scale: 2 }).default("0"),
  credit: numeric("credit", { precision: 15, scale: 2 }).default("0"),
  referenceNo: text("reference_no"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("bank_txn_statement_idx").on(table.bankStatementId),
]);

export const bankReconMatches = pgTable("bank_recon_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  bankTransactionId: uuid("bank_transaction_id").notNull().references(() => bankTransactions.id),
  journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id),
  matchType: text("match_type").notNull(), // "auto" | "manual"
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  confirmedBy: uuid("confirmed_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("bank_recon_txn_unique").on(table.bankTransactionId),
  index("bank_recon_tenant_confirmed_idx").on(table.tenantId, table.confirmedAt),
]);
```

- [ ] **Step 4: Modify existing tables**

On `journalLines` table: add `journalEntryId` column, make `documentId` nullable.
On `documents` table: add `dueDate` column.
On `tenants` table: add `nextJvSequence` column.

- [ ] **Step 5: Update relations.ts**

Add relations for `journalEntries`, `payments`, `bankTransactions`, `bankReconMatches` to the existing relations file.

- [ ] **Step 6: Add type exports to `src/types/domain.ts`**

Add `InferSelectModel` exports for new tables:
```typescript
export type JournalEntry = InferSelectModel<typeof journalEntries>;
export type Payment = InferSelectModel<typeof payments>;
export type BankTransaction = InferSelectModel<typeof bankTransactions>;
export type BankReconMatch = InferSelectModel<typeof bankReconMatches>;
```

- [ ] **Step 7: Add API response types to `src/types/api.ts`**

Add types for:
- `JournalEntryWithLines` (entry + joined lines array)
- `JournalEntryListResponse` (paginated list + stats)
- `AccountLedgerResponse` (opening balance, transactions, closing balance)
- `AgingCustomer` / `AgingVendor` (customer/vendor with aging buckets + invoices)
- `ReceivablesResponse` / `PayablesResponse` (customers/vendors + totals + stats)
- `PaymentResponse` (payment + created journal entry)

- [ ] **Step 8: Generate and review migration**

Run: `npx drizzle-kit generate`
Expected: Creates a new migration file in `supabase/migrations/` (auto-named).

Review the generated SQL to ensure:
- Enum changes are correct (Manual added, journalStatusEnum created)
- Foreign keys are created
- Indexes are created
- `documentId` on journalLines is now nullable (`ALTER COLUMN ... DROP NOT NULL`)

- [ ] **Step 9: Write backfill migration for existing data**

Create a manual SQL migration that runs AFTER the schema migration:
1. Create `journalEntries` header rows for all existing `journalLines` groups (grouped by `documentId`)
2. Set `jvNumber` based on existing document reference or sequential
3. Set `type` from the associated document's journal type
4. Set `status = 'posted'` for all existing entries
5. Populate `journalEntryId` on all existing `journalLines`
6. Only then can the `journalEntryId NOT NULL` constraint be enforced

This is critical — without backfill, the NOT NULL constraint on `journalEntryId` will fail on existing data.

- [ ] **Step 10: Apply migrations**

Run: `npx drizzle-kit push` (or apply via Supabase dashboard)
Verify: Tables created, existing data migrated, no errors.

- [ ] **Step 11: Update `tax-gl-mapping.ts` to create journalEntries headers**

Modify `src/lib/services/tax-gl-mapping.ts` to also create a `journalEntries` record when auto-posting journal lines from approved documents. This ensures all new data uses the header table pattern.

- [ ] **Step 12: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/relations.ts src/types/domain.ts src/types/api.ts supabase/migrations/ src/lib/services/tax-gl-mapping.ts
git commit -m "feat(schema): add journalEntries, payments, bankTransactions tables for Phase 3"
```

---

## Task 2: Design Tokens + CSS Variables

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add badge and aging CSS variables to `@theme inline` section**

```css
/* Journal type badge colors */
--badge-purv-bg: #eff6ff;
--badge-purv-text: #1d4ed8;
--badge-rv-bg: #f0fdf4;
--badge-rv-text: #15803d;
--badge-sv-bg: #faf5ff;
--badge-sv-text: #7c3aed;
--badge-jv-bg: #fefce8;
--badge-jv-text: #a16207;
--badge-manual-bg: #f1f5f9;
--badge-manual-text: #475569;

/* Aging gradient colors */
--aging-current: var(--color-foreground);
--aging-30: var(--color-foreground);
--aging-60: #d97706;
--aging-90: #ea580c;
--aging-overdue: var(--color-destructive);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No CSS errors, tokens accessible.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(tokens): add journal badge and aging color CSS variables"
```

---

## Task 3: Shared Components — DataTable Expansion

**Files:**
- Modify: `src/components/data-table.tsx`

- [ ] **Step 1: Read existing DataTable component**

Understand the current props interface and rendering logic.

- [ ] **Step 2: Add expandedRow prop to DataTable**

Add to the props interface:
```typescript
expandedRow?: (row: T) => React.ReactNode;
expandedRowIds?: Set<string>;
onToggleExpand?: (rowId: string) => void;
getRowId?: (row: T) => string;
```

- [ ] **Step 3: Render expanded rows**

After each `<tr>` in the tbody, conditionally render:
```tsx
{expandedRow && expandedRowIds?.has(getRowId(row)) && (
  <tr className="bg-[var(--surface-secondary)]">
    <td colSpan={columns.length}>
      {expandedRow(row)}
    </td>
  </tr>
)}
```

- [ ] **Step 4: Verify existing DataTable usage is unaffected**

Run: `npm run build`
Expected: No type errors, existing pages using DataTable unchanged (new props are optional).

- [ ] **Step 5: Commit**

```bash
git add src/components/data-table.tsx
git commit -m "feat(data-table): add expandedRow render prop for inline expansion"
```

---

## Task 4: Shared Components — CurrencyInput, AccountSelect, AgingMiniBar

**Files:**
- Create: `src/components/currency-input.tsx`
- Create: `src/components/account-select.tsx`
- Create: `src/components/aging-mini-bar.tsx`

- [ ] **Step 1: Create CurrencyInput component**

```typescript
// src/components/currency-input.tsx
"use client";
// Props: value (number), onChange, disabled, placeholder
// Renders: div with ฿ prefix span + input
// Features: thousand separator formatting, tabular-nums, Zod validation
```

Input with `฿` prefix, auto-formats on blur (adds thousand separators), stores raw number value. Uses existing Input component styles.

- [ ] **Step 2: Create AccountSelect component**

```typescript
// src/components/account-select.tsx
"use client";
// Props: value (accountCode), onChange, tenantId
// Fetches COA from React Query, groups by category
// Renders: searchable dropdown with account code (monospace) + name + category badge
```

Uses existing `Select` component pattern. Groups accounts by category (Asset/Liability/Equity/Revenue/Expense). Searchable by code or name.

- [ ] **Step 3: Create AgingMiniBar component**

```typescript
// src/components/aging-mini-bar.tsx
// Props: buckets: { current: number, d30: number, d60: number, d90: number, overdue: number }
// Renders: horizontal stacked bar with colored segments proportional to bucket values
// Colors use CSS variables: --aging-current through --aging-overdue
```

Simple presentational component, no state.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: All components compile, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/currency-input.tsx src/components/account-select.tsx src/components/aging-mini-bar.tsx
git commit -m "feat(components): add CurrencyInput, AccountSelect, AgingMiniBar"
```

---

## Task 5: Shared Components — JournalLineEditor

**Files:**
- Create: `src/components/journal-line-editor.tsx`

- [ ] **Step 1: Create JournalLineEditor component**

```typescript
// src/components/journal-line-editor.tsx
"use client";
// Props: lines (JournalLine[]), onChange, disabled
// JournalLine: { accountCode, deptCode, debit, credit, description }
// Features:
//   - Each row: AccountSelect, department Select, CurrencyInput (debit), CurrencyInput (credit), text input, delete icon
//   - "Add Row" button at bottom
//   - Footer: Total Debit, Total Credit, Difference (green ✓ if 0, red if mismatch)
//   - Tab navigation between cells
//   - Enter on last row adds new row
```

Uses `AccountSelect` and `CurrencyInput` from Task 4. Renders as a table with editable rows.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiles, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/journal-line-editor.tsx
git commit -m "feat(components): add JournalLineEditor for manual JV creation"
```

---

## Task 6: Services — JV Number, Payment Status, Aging

**Files:**
- Create: `src/lib/services/jv-number.ts`
- Create: `src/lib/services/payment-status.ts`
- Create: `src/lib/services/aging.ts`
- Create: `src/lib/utils/csv-export.ts`

- [ ] **Step 1: Create JV number generation service**

```typescript
// src/lib/services/jv-number.ts
// generateJvNumber(db, tenantId): Promise<string>
// Uses: UPDATE tenants SET next_jv_sequence = next_jv_sequence + 1 WHERE id = ? RETURNING next_jv_sequence
// Format: JV-{YYYY}-{NNNN} zero-padded
// Must be called inside a transaction for concurrency safety
```

- [ ] **Step 2: Create payment status computation service**

```typescript
// src/lib/services/payment-status.ts
// computePaymentStatus(document, paymentSum): "open" | "partial" | "paid" | "overdue"
// Logic:
//   if paymentSum >= grandTotal → "paid"
//   if dueDate < today && paymentSum < grandTotal → "overdue"
//   if paymentSum > 0 && paymentSum < grandTotal → "partial"
//   else → "open"
```

- [ ] **Step 3: Create aging bucket service**

```typescript
// src/lib/services/aging.ts
// computeAgingBucket(dueDate, today): "current" | "d30" | "d60" | "d90" | "overdue"
// aggregateAging(documents[]): { current, d30, d60, d90, overdue, total }
// Overdue-based aging: days past due date
```

- [ ] **Step 4: Create CSV export utility**

```typescript
// src/lib/services/csv-export.ts
// exportToCsv(columns, rows, filename): void
// Client-side CSV generation, triggers browser download
// Handles Thai text encoding (UTF-8 BOM)
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/jv-number.ts src/lib/services/payment-status.ts src/lib/services/aging.ts src/lib/services/csv-export.ts
git commit -m "feat(services): add JV numbering, payment status, aging, CSV export"
```

---

## Task 7: Database Queries — Journal Entries

**Files:**
- Create: `src/lib/db/queries/journal-entries.ts`
- Create: `src/lib/db/queries/account-ledger.ts`

- [ ] **Step 1: Create journal entries query module**

```typescript
// src/lib/db/queries/journal-entries.ts
// listJournalEntries(db, tenantId, filters): paginated list with joined lines
//   filters: { dateFrom, dateTo, type, status, search, page, pageSize }
//   joins: journalEntries → journalLines, journalEntries → documents (for source link)
//   returns: { entries, total, page, pageSize }
//
// getJournalEntry(db, tenantId, entryId): single entry with all lines
// createJournalEntry(db, tenantId, data): creates header + lines in transaction
// updateJournalEntry(db, tenantId, entryId, data): updates header + lines, logs to audit
// postJournalEntry(db, tenantId, entryId): changes status to "posted"
// getJournalEntryStats(db, tenantId, dateFrom, dateTo): { totalEntries, draftCount, totalDebits, totalCredits }
// reverseJournalEntry(db, tenantId, entryId): creates new reversal entry with reversed debits/credits, sets original status to "reversed", links via reversedFromId
```

- [ ] **Step 2: Create account ledger query module**

```typescript
// src/lib/db/queries/account-ledger.ts
// getAccountLedger(db, tenantId, accountCode, dateFrom, dateTo):
//   returns: { openingBalance, transactions[], closingBalance, periodDebits, periodCredits, netMovement }
//   openingBalance: sum of all debit-credit for account before dateFrom
//   transactions: journalLines joined with journalEntries, ordered by date
//   each transaction includes running balance
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/journal-entries.ts src/lib/db/queries/account-ledger.ts
git commit -m "feat(queries): add journal entries and account ledger query modules"
```

---

## Task 8: Database Queries — Receivables, Payables, Payments

**Files:**
- Create: `src/lib/db/queries/receivables.ts`
- Create: `src/lib/db/queries/payables.ts`
- Create: `src/lib/db/queries/payments.ts`

- [ ] **Step 1: Create receivables query module**

```typescript
// src/lib/db/queries/receivables.ts
// getReceivablesAging(db, tenantId, filters): aging by customer
//   filters: { dateFrom, dateTo, search, status }
//   Query: documents WHERE direction = receivable
//   JOIN customers ON documents.vendorOrCustomerId
//   LEFT JOIN payments (sum per document)
//   Group by customer, compute aging buckets using dueDate
//   returns: { customers: [{ customer, buckets, total, invoices[] }], totals, stats }
//
// getReceivablesStats(db, tenantId):
//   returns: { totalOutstanding, overdueCount, overdueAmount, collectedThisMonth, avgCollectionDays }
```

- [ ] **Step 2: Create payables query module**

```typescript
// src/lib/db/queries/payables.ts
// Same structure as receivables but for vendors
// getPayablesAging(db, tenantId, filters)
// getPayablesStats(db, tenantId)
// Additional: include vendor.defaultWhtRate in results
//
// NOTE: Direction enum mapping:
//   AR (receivables) = documents WHERE direction = "REVENUE"
//   AP (payables) = documents WHERE direction = "EXPENSE"
//   The existing directionEnum uses "REVENUE"/"EXPENSE", not "receivable"/"payable"
```

- [ ] **Step 3: Create payments query module**

```typescript
// src/lib/db/queries/payments.ts
// recordPayment(db, tenantId, data): creates payment + offsetting journal entry in transaction
//   For AP with WHT: creates two JE lines (payment + WHT payable)
//   Uses jv-number.ts for JV number generation
//   Validates: period not locked, amount <= remaining
// getPaymentsForDocument(db, tenantId, documentId): list of payments
// getPaymentSum(db, tenantId, documentId): total paid amount
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/queries/receivables.ts src/lib/db/queries/payables.ts src/lib/db/queries/payments.ts
git commit -m "feat(queries): add receivables, payables, payments query modules"
```

---

## Task 9: API Routes — Journal Entries

**Files:**
- Create: `src/app/api/tenants/[id]/journal-entries/route.ts`
- Create: `src/app/api/tenants/[id]/journal-entries/[entryId]/route.ts`
- Create: `src/app/api/tenants/[id]/account-ledger/route.ts`

- [ ] **Step 1: Create journal entries list + create API (with Zod validation)**

Define Zod schemas inline in the route file (following existing API route patterns):
- `journalEntryQuerySchema`: dateFrom, dateTo (optional dates), type (enum), status (enum), search (string, max 100), page (number, min 1), pageSize (number, max 100)
- `createJournalEntrySchema`: date (string), description (string, min 1), type (enum), lines (array of { accountCode, deptCode?, debit, credit, description })

```typescript
// src/app/api/tenants/[id]/journal-entries/route.ts
// GET: list with filters (dateFrom, dateTo, type, status, search, page)
//   Auth: getRequestContext + ensureTenantScope
//   Validate: Zod schema for query params, cap search length
//   Returns: { entries, total, page, pageSize, stats }
//
// POST: create new journal entry
//   Auth: getRequestContext + ensureTenantScope
//   Validate: Zod schema (date, description, type, lines[])
//   Check: period not locked for the entry date
//   Generate: JV number via jv-number.ts
//   Returns: created entry with id and jvNumber
```

- [ ] **Step 2: Create single entry API (get, edit, post status)**

```typescript
// src/app/api/tenants/[id]/journal-entries/[entryId]/route.ts
// GET: single entry with all lines
// PUT: update entry (header + lines)
//   Check: not reversed, period not locked
//   Log: before/after to auditLogs
// PATCH: change status (post or reverse)
//   post: draft → posted
//   reverse: posted → creates new reversal entry
```

- [ ] **Step 3: Create account ledger API**

```typescript
// src/app/api/tenants/[id]/account-ledger/route.ts
// GET: account transactions with running balance
//   Params: accountCode, dateFrom, dateTo
//   Validate: accountCode exists in tenant's COA
//   Returns: { openingBalance, transactions[], closingBalance, periodDebits, periodCredits, netMovement }
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: All routes compile.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tenants/[id]/journal-entries/ src/app/api/tenants/[id]/account-ledger/
git commit -m "feat(api): add journal entries CRUD and account ledger endpoints"
```

---

## Task 10: API Routes — Receivables, Payables, Payments

**Files:**
- Create: `src/app/api/tenants/[id]/receivables/route.ts`
- Create: `src/app/api/tenants/[id]/payables/route.ts`
- Create: `src/app/api/tenants/[id]/payments/route.ts`

- [ ] **Step 1: Create receivables API**

```typescript
// GET /api/tenants/[id]/receivables
// Auth + tenant scope
// Params: dateFrom, dateTo, search, status, page
// Returns: { customers[], totals, stats }
```

- [ ] **Step 2: Create payables API**

```typescript
// GET /api/tenants/[id]/payables
// Same structure as receivables, vendor direction
// Includes vendor WHT rates
```

- [ ] **Step 3: Create payments API (with Zod validation)**

Define `recordPaymentSchema` inline: documentId (uuid), amount (number, positive), whtAmount (number, >= 0, optional), paymentDate (string), paymentMethod (enum: bank_transfer/cheque/cash/promptpay), referenceNo (string, optional), notes (string, optional).

```typescript
// POST /api/tenants/[id]/payments
// Auth + tenant scope
// Body: { documentId, amount, whtAmount, paymentDate, paymentMethod, referenceNo, notes }
// Validate: Zod schema, period not locked, amount <= remaining
// Creates: payment record + offsetting journal entry
// For AP with WHT: two JE lines (payment + WHT payable account)
// Returns: { payment, journalEntry }
```

- [ ] **Step 4: Fix bank-statements error.message leak**

In `src/app/api/tenants/[id]/bank-statements/route.ts`, replace any `error.message` in response with generic message. Log the actual error server-side.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tenants/[id]/receivables/ src/app/api/tenants/[id]/payables/ src/app/api/tenants/[id]/payments/ src/app/api/tenants/[id]/bank-statements/
git commit -m "feat(api): add receivables, payables, payments endpoints; fix error leak"
```

---

## Task 11: React Query Hooks

**Files:**
- Create: `src/lib/hooks/use-journal-entries.ts`
- Create: `src/lib/hooks/use-account-ledger.ts`
- Create: `src/lib/hooks/use-receivables.ts`
- Create: `src/lib/hooks/use-payables.ts`
- Create: `src/lib/hooks/use-payments.ts`

- [ ] **Step 1: Read existing hooks for patterns**

Read `src/lib/hooks/use-documents.ts` to understand the project's React Query patterns (query keys, fetch functions, mutation patterns, error handling).

- [ ] **Step 2: Create all hooks following the same pattern**

Each hook:
- Uses `useQuery` for data fetching with typed query keys
- Uses `useMutation` for create/update/delete with `onSuccess` cache invalidation
- Returns `{ data, isLoading, error }` for queries
- Returns `{ mutate, isPending }` for mutations
- Uses `useToast()` for success/error feedback in mutations

Hooks to create:
- `use-journal-entries.ts`: `useJournalEntries(filters)`, `useJournalEntry(id)`, `useCreateJournalEntry()`, `useUpdateJournalEntry()`, `usePostJournalEntry()`, `useReverseJournalEntry()`
- `use-account-ledger.ts`: `useAccountLedger(accountCode, dateFrom, dateTo)`
- `use-receivables.ts`: `useReceivables(filters)`, `useReceivablesStats()`
- `use-payables.ts`: `usePayables(filters)`, `usePayablesStats()`
- `use-payments.ts`: `useRecordPayment()`

Note: `use-bank-recon.ts` is deferred to Task 16 (Bank Reconciliation) since it depends on bank-specific services and queries built in that task.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-journal-entries.ts src/lib/hooks/use-account-ledger.ts src/lib/hooks/use-receivables.ts src/lib/hooks/use-payables.ts src/lib/hooks/use-payments.ts
git commit -m "feat(hooks): add React Query hooks for GL, AR, AP, payments"
```

---

## Task 12: Sidebar Navigation Update

**Files:**
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Read sidebar.tsx to understand nav structure**

Find the `navGroups` array and the icon import pattern.

- [ ] **Step 2: Add Accounting nav group**

Add after the existing nav groups (before Settings):

```typescript
{
  label: "Accounting",
  items: [
    { href: "/ledger", label: "General Ledger", icon: BookOpen },
    { href: "/receivables", label: "Receivables", icon: ArrowDownToLine },
    { href: "/payables", label: "Payables", icon: ArrowUpFromLine },
    { href: "/bank-recon", label: "Bank Recon", icon: ArrowLeftRight },
  ],
}
```

Add imports: `BookOpen, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight` from `lucide-react`.

- [ ] **Step 3: Verify build + visual check**

Run: `npm run dev`
Expected: Sidebar shows new Accounting group with 4 items.

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(nav): add Accounting group to sidebar (GL, AR, AP, Bank Recon)"
```

---

## Task 13: General Ledger Page

**Files:**
- Create: `src/app/(app)/ledger/page.tsx`

- [ ] **Step 1: Create GL page with stat cards + tabs shell**

`"use client"` page with:
- Page header (title, subtitle, Export + New JV buttons)
- 4 `StatCard` components using `useJournalEntries` stats
- `Tabs` component with "Journal Entries" and "Account Ledger"
- Wrap in `<Suspense>` (required for `useSearchParams`)

- [ ] **Step 2: Implement Journal Entries tab**

- Filter toolbar: date range, type dropdown, status pills, search input
- `DataTable` with `expandedRow` prop
- Type badges using CSS variable colors
- Status badges
- Source document links
- Edit button (disabled for reversed/locked entries)
- Pagination

- [ ] **Step 3: Implement expanded journal lines detail**

Component that renders inside `expandedRow`:
- Sub-table with account code, account name, department, description, debit, credit
- Footer row: Total Debit, Total Credit, Difference

- [ ] **Step 4: Implement Account Ledger tab**

- `AccountSelect` for picking account
- Date range picker
- Opening balance banner
- Transaction table with running balance
- Summary footer (period debits, credits, net movement)
- Closing balance banner

- [ ] **Step 5: Implement JV creation/edit modal**

- `Modal` wrapper
- Date picker, description input
- `JournalLineEditor` for lines
- "Save as Draft" and "Post" buttons
- Debit/credit balance validation
- Edit mode: pre-fill from existing entry

- [ ] **Step 6: Add loading skeletons and empty states**

- 4 skeleton stat cards
- Table skeleton (8 rows)
- Empty state for no entries ("No journal entries found")

- [ ] **Step 7: Add CSV export**

Wire Export button to `src/lib/utils/csv-export.ts` utility using current filter state from React Query cache.

- [ ] **Step 8: Verify build + visual check against mockup**

Run: `npm run build && npm run dev`
Compare against mockup: `.superpowers/brainstorm/45399-1774208299/gl-ledger-v2.html`

- [ ] **Step 9: Commit**

```bash
git add src/app/(app)/ledger/
git commit -m "feat(ledger): add General Ledger page with Journal Entries and Account Ledger tabs"
```

---

## Task 14: Accounts Receivable Page

**Files:**
- Create: `src/app/(app)/receivables/page.tsx`

- [ ] **Step 1: Create AR page with stat cards**

`"use client"` page with:
- Page header (title "Accounts Receivable", subtitle "ลูกหนี้การค้า", Export button)
- 4 stat cards: Total Outstanding, Overdue (red accent), Collected This Month (green accent), Avg Collection Days
- Uses `useReceivablesStats()` hook

- [ ] **Step 2: Implement aging table**

- Filter toolbar: date range, customer search, status pills
- `DataTable` with aging columns (Current, 1-30d, 31-60d, 61-90d, 90+d, Total)
- Aging color gradient using CSS variables
- Customer name + Tax ID stacked
- Footer row with totals

- [ ] **Step 3: Implement expanded customer detail**

- Invoice sub-table: Invoice No., Date, Due Date, Amount, Paid, Remaining, Status, Source, Action
- Due date color-coding (overdue = red, due soon = amber)
- Overdue badges with days count ("Overdue 37d")
- `AgingMiniBar` showing proportions
- "Record Payment" button per invoice

- [ ] **Step 4: Implement payment recording modal**

- Invoice summary section (read-only)
- `CurrencyInput` for payment amount (pre-filled with remaining)
- Date picker, payment method dropdown, reference no, notes
- Cancel + Record Payment buttons
- Uses `useRecordPayment()` mutation

- [ ] **Step 5: Add loading skeletons, empty states, CSV export**

- [ ] **Step 6: Verify build + visual check against mockup**

Compare against: `.superpowers/brainstorm/45399-1774208299/ar-receivables-v2.html`

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/receivables/
git commit -m "feat(receivables): add Accounts Receivable page with aging table and payment recording"
```

---

## Task 15: Accounts Payable Page

**Files:**
- Create: `src/app/(app)/payables/page.tsx`

- [ ] **Step 1: Create AP page (mirror AR structure)**

Same layout as AR with vendor-specific changes:
- Stat cards: Total Payables, Due This Week (amber), Paid This Month (green), Top Vendor
- Uses `usePayablesStats()` hook

- [ ] **Step 2: Implement aging table with vendor data**

Same structure as AR aging table but:
- Vendor Name + Tax ID
- WHT rate badge next to vendor name when applicable

- [ ] **Step 3: Implement expanded vendor detail with WHT**

Same as AR invoice detail plus:
- WHT indicator column

- [ ] **Step 4: Implement payment recording modal with WHT**

Same as AR modal plus:
- WHT Deduction field (auto-calculated from vendor's `defaultWhtRate`)
- Shows: Gross Amount, WHT Amount, Net Payment
- WHT amount editable (override auto-calc)
- Uses same `useRecordPayment()` mutation with WHT data

- [ ] **Step 5: Add loading skeletons, empty states, CSV export**

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/payables/
git commit -m "feat(payables): add Accounts Payable page with aging table, WHT, and payment recording"
```

---

## Task 16: Bank Reconciliation Page (Minimal)

**Files:**
- Create: `src/app/(app)/bank-recon/page.tsx`
- Create: `src/lib/services/bank-matching.ts`
- Create: `src/lib/db/queries/bank-recon.ts`
- Create: `src/lib/hooks/use-bank-recon.ts`
- Modify: `src/app/api/tenants/[id]/bank-recon/route.ts`
- Create: `src/app/api/tenants/[id]/bank-recon/matches/route.ts`

- [ ] **Step 1: Create bank matching service**

```typescript
// src/lib/services/bank-matching.ts
// autoMatch(bankTransactions[], glEntries[]): Match[]
// Match: { bankTransactionId, journalEntryId, confidence }
// Logic: exact amount match within ±3 day window
// Confidence: 1.0 for exact amount+date, 0.8 for exact amount ±1 day, etc.
```

- [ ] **Step 2: Create bank recon queries**

```typescript
// src/lib/db/queries/bank-recon.ts
// getUnmatchedBankTransactions(db, tenantId, bankStatementId)
// getUnmatchedGLEntries(db, tenantId, bankAccountCode, dateFrom, dateTo)
// createMatch(db, tenantId, bankTransactionId, journalEntryId, matchType)
// confirmMatch(db, tenantId, matchId)
// deleteMatch(db, tenantId, matchId)
// getReconSummary(db, tenantId, bankStatementId): { statementBalance, glBalance, difference, matchedCount, unmatchedCount }
```

- [ ] **Step 3: Rewrite bank-recon API route**

Update existing `src/app/api/tenants/[id]/bank-recon/route.ts` to:
- Match against GL entries (not documents)
- Return bank transactions + GL entries + auto-match suggestions + summary

- [ ] **Step 4: Create matches API route**

```typescript
// POST /api/tenants/[id]/bank-recon/matches — confirm a match
// DELETE /api/tenants/[id]/bank-recon/matches/[matchId] — unmatch
```

- [ ] **Step 5: Create React Query hook**

`use-bank-recon.ts`: `useBankRecon(bankStatementId)`, `useConfirmMatch()`, `useDeleteMatch()`, `useBulkConfirm()`

- [ ] **Step 6: Create Bank Recon page**

- Page header + summary bar (Statement Balance, GL Balance, Difference)
- Split view: left = bank transactions, right = unmatched GL entries
- Auto-matched pairs highlighted with confidence + Confirm button
- Click bank txn → click GL entry to manually match
- "Confirm All" button for high-confidence matches

- [ ] **Step 7: Verify build**

Run: `npm run build`

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/bank-recon/ src/lib/services/bank-matching.ts src/lib/db/queries/bank-recon.ts src/lib/hooks/use-bank-recon.ts src/app/api/tenants/[id]/bank-recon/
git commit -m "feat(bank-recon): add Bank Reconciliation page with auto-matching"
```

---

## Task 17: Final Integration + Polish

**Files:**
- Various files from Tasks 1–16

- [ ] **Step 1: Full build verification**

Run: `npm run build`
Fix any type errors or build failures.

- [ ] **Step 2: Visual check all 4 pages**

Run: `npm run dev`
Navigate to `/ledger`, `/receivables`, `/payables`, `/bank-recon`.
Verify against mockups and spec.

- [ ] **Step 3: Check responsive behavior**

Test at 375px, 768px, 1024px, 1440px breakpoints.
Verify stat cards, tables, modals respond correctly.

- [ ] **Step 4: Check period lock enforcement**

Verify: locked period entries show disabled edit button.
Verify: JV creation with locked period date shows error.
Verify: Payment recording in locked period shows error.

- [ ] **Step 5: Check sidebar navigation**

All 4 pages reachable from sidebar.
Active state shows correctly on current page.

- [ ] **Step 6: Final commit**

```bash
git add src/app/(app)/ledger/ src/app/(app)/receivables/ src/app/(app)/payables/ src/app/(app)/bank-recon/ src/components/ src/lib/ src/app/api/tenants/
git commit -m "feat(phase3): complete accounting modules - GL, AR, AP, Bank Recon"
```
