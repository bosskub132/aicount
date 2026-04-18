# Phase 5: Settings Polish + User Feedback — Design Spec

**Date:** 2026-03-30
**Status:** Draft (Rev 2 — post-review fixes)
**Branch:** feature/app-v2
**Environment:** Staging Supabase project (separate from prod)

## Context

Phase 5 addresses the "Settings Polish" milestone plus gaps identified from production user feedback (docs/feedback/AICount_review.xlsx). The feedback revealed that cosmetic restyling alone is insufficient — users need CSV/Excel import for master data, better onboarding, and several UX improvements that block real adoption.

### User Feedback Summary (Production)

| Priority | Feedback | Phase 5 Response |
|----------|----------|-----------------|
| **Critical** | COA/dept/vendor/customer manual entry doesn't scale — need import | CSV/Excel import on onboarding + settings |
| **Critical** | All settings & onboarding pages use raw HTML, not design system | Full restyle to Button/Input/Card/Select/DataTable |
| **High** | No vendors/customers step in onboarding | Add combined step |
| **High** | Period locks page is a single text input — need list/toggle | Proper period list with lock/unlock |
| **High** | Role descriptions missing ("what can maker/checker do?") | Add role info cards |
| **Medium** | Suspense account unexplained | Add tooltip |
| **Medium** | "Create reversal" unexplained | Add tooltip |
| **Medium** | Products page purpose unclear | Add hint on onboarding complete page |
| **Medium** | Customer missing address/credit limit fields | Extend schema |
| **Medium** | Buyer name mismatch with workspace — no alert | Add validation alert |
| **Medium** | Export templates page is a stub | Build template CRUD |
| **Low** | Invitation tracking — no status list | Already exists in settings, improve in onboarding |

---

## UI Consistency Rules (Cross-Cutting)

**Every page touched in Phase 5 MUST follow these patterns.** This eliminates the current inconsistency where onboarding and settings pages use raw HTML while core app pages use the design system.

### Component Usage (Mandatory)

| Element | Use This | NOT This |
|---------|----------|----------|
| Buttons | `<Button variant="primary/secondary/destructive/ghost">` | Raw `<button className="bg-blue-600...">` |
| Text inputs | `<Input label="..." error="..." helperText="...">` | Raw `<input className="border-slate-300...">` |
| Dropdowns | `<Select options={...} searchable>` | Raw `<select>` |
| Tables | `<DataTable columns={...} data={...}>` | Raw `<table>` |
| Dialogs | `<Modal open={...} onClose={...} title="..." actions={...}>` | Custom dialog markup |
| Feedback | `useToast()` from `@/lib/stores/ui-store` | Inline `{message && <p>...}` |
| Empty states | `<EmptyState icon={...} title="..." action={...}>` | Inline "No data" text |
| Status pills | `<Badge variant="...">` | Inline `<span className="bg-yellow-50...">` |
| Cards | `<Card title="...">` or styled `div` with CSS vars | Hardcoded `border-slate-200 bg-white` |
| Tooltips | `<Tooltip content="...">` | No explanation at all |
| Loading | `<Button loading>` or `<Skeleton>` | Custom spinner divs |

### Color & Token Usage

```
ALWAYS: var(--primary), var(--border), var(--muted), var(--destructive), etc.
NEVER:  bg-blue-600, border-slate-300, text-red-700, bg-slate-900
```

### Radius & Shadow

```
Inputs:  rounded-[var(--radius-input)]    (6px)
Buttons: rounded-[var(--radius-button)]   (8px)
Cards:   rounded-[var(--radius-card)]     (10px)
Modals:  rounded-[var(--radius-modal)]    (12px)
Shadows: use `--shadow-sm`, `--shadow-md`, or `--shadow-lg`
```

### Page Header Pattern (Settings)

Every settings page follows this structure (matching profile, security pages):

```tsx
<section className="space-y-6">
  <div className="flex items-center gap-3">
    <Icon className="h-6 w-6 text-[var(--muted-foreground)]" />
    <div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Page Title</h1>
      <p className="text-sm text-[var(--muted-foreground)]">Description text.</p>
    </div>
  </div>
  {/* Content in Card or DataTable */}
</section>
```

### Onboarding Page Pattern

Every onboarding step follows this structure (established in existing steps):

```tsx
<div className="mx-auto max-w-2xl">
  {/* Page header with icon bubble */}
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)]">
      <Icon className="h-5 w-5 text-[var(--primary)]" />
    </div>
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Step Title</h1>
      <p className="text-sm text-[var(--muted-foreground)]">Description</p>
    </div>
  </div>

  {/* Form card */}
  <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
    {/* Content */}
  </div>

  {/* Navigation: Back | Skip | Next */}
  <div className="mt-6 flex items-center justify-between">
    <Button variant="secondary" icon={<ArrowLeft />}>Back</Button>
    <Button variant="link" onClick={handleSkip}>I'll do this later</Button>
    <Button variant="primary" loading={loading} icon={<ArrowRight />}>Next</Button>
  </div>
</div>
```

---

## Phase 5A: Onboarding Polish + Import

### Scope

Restyle all 8 onboarding steps (7 existing + 1 new) to use design system components, add CSV/Excel import to data steps, add vendors/customers step.

### Updated Onboarding Flow

```
Step 1: Welcome           (restyle only)
Step 2: Workspace          (restyle — Button, Input with label/validation)
Step 3: Chart of Accounts  (restyle + add CSV/Excel import)
Step 4: Vendors & Customers (NEW — tabs, manual + import)
Step 5: Departments        (restyle + add CSV/Excel import)
Step 6: Team               (restyle + add role descriptions)
Step 7: Template           (restyle — use RadioGroup component pattern)
Step 8: Complete           (restyle + add product hint + settings shortcut)
```

### Shared FileImport Component

Build `src/components/file-import.tsx` — reusable across onboarding and settings.

**Props:**
```typescript
interface FileImportProps {
  /** Which entity type — determines column expectations */
  entityType: "coa" | "vendor" | "customer" | "department" | "product";
  /** Called with parsed & validated rows */
  onImport: (rows: Record<string, unknown>[]) => void;
  /** Max rows allowed (default 5000) */
  maxRows?: number;
}
```

**UX Flow:**
1. **Upload zone** — drag-drop or click to select file (.csv, .xlsx, .xls)
2. **Column mapping preview** — show first 5 rows in DataTable, auto-map columns by header name matching, allow manual column reassignment via Select dropdowns
3. **Validation summary** — show row count, error count (missing required fields, invalid formats), warning count (duplicate codes)
4. **Import button** — disabled until 0 errors. Shows progress for large files.

**Column expectations per entity:**

| Entity | Required Columns | Optional Columns |
|--------|-----------------|-----------------|
| COA | accountCode, accountName, category | isSuspense, parentCode (for sub-grouping) |
| Vendor | taxId, name | address, vendorType, branchNumber, country, isNonResident, defaultExpenseGl, defaultWhtRate |
| Customer | taxId, name | address, creditTermDays, creditLimit, branchNumber |
| Department | deptCode, deptName | — |
| Product | itemCode, itemName | keywords, incomeGl, expenseGl |

**File parsing:**
- CSV: use `papaparse` (handles Thai encoding, auto-detects BOM/TIS-620)
- Excel: use `exceljs` (MIT license) — read first sheet, auto-detect header row
- Both parse client-side (no server upload for preview)
- Max file size: 5MB (validate before parsing)
- Max rows: 5000 (prevent browser freeze)

### Step 4: Vendors & Customers (NEW)

**Layout:** Two tabs (Vendors | Customers) using the `<Tabs>` component.

Each tab has:
- Toggle between "Manual Entry" and "Import File" modes
- Manual entry: form fields matching the entity schema, Add button, DataTable showing added rows with remove action
- Import: FileImport component

**Vendor fields (manual):**
- Name (required), Tax ID (required, 13-digit validation)
- Type: Select with options "company" | "individual" (default: company)
- Branch Number, Address (optional)
- Default WHT Rate: Select with options 1%, 2%, 3%, 5%, 10%, 15%
- Non-resident checkbox

**Customer fields (manual):**
- Name (required), Tax ID (required, 13-digit validation)
- Branch Number, Address, Credit Term Days (optional)

### Step 6: Team — Role Descriptions

Add an info card above the invite form:

```
┌─────────────────────────────────────────────────┐
│  Roles                                          │
│                                                 │
│  👤 Maker                                       │
│  Upload documents, edit extractions, create      │
│  journal entries, record payments.               │
│                                                 │
│  ✅ Checker                                      │
│  Review & approve documents, post journal        │
│  entries, generate reports and certificates.     │
│                                                 │
│  🔑 Admin (workspace creator)                   │
│  Full access including settings, master data,    │
│  member management, and workspace deletion.      │
└─────────────────────────────────────────────────┘
```

Use `<Card>` with a list layout. Icons from lucide-react (User, CheckCircle2, KeyRound).

### Step 8: Complete — Product Hint

Add below the "You're all set" message:

```tsx
<div className="mt-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--info-light)] p-4">
  <div className="flex items-start gap-3">
    <Lightbulb className="h-5 w-5 text-[var(--primary)] mt-0.5 shrink-0" />
    <div>
      <p className="text-sm font-medium text-[var(--foreground)]">
        Speed up document processing
      </p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Set up Products in Settings → Master Data to auto-map line items
        to GL accounts.
      </p>
    </div>
  </div>
</div>

{/* Two buttons */}
<div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
  <Button variant="primary" onClick={handleComplete} loading={completing}>
    Go to Dashboard
  </Button>
  <Button variant="ghost" onClick={() => router.push("/settings/masterdata/products")}>
    Set up Products →
  </Button>
</div>
```

### Onboarding Layout Update

Update `STEPS` array in layout.tsx to include the new step:

```typescript
const STEPS = [
  { label: "Welcome", path: "/onboarding" },
  { label: "Workspace", path: "/onboarding/workspace" },
  { label: "Accounts", path: "/onboarding/chart-of-accounts" },
  { label: "Partners", path: "/onboarding/vendors-customers" },  // NEW
  { label: "Departments", path: "/onboarding/departments" },
  { label: "Team", path: "/onboarding/team" },
  { label: "Template", path: "/onboarding/template" },
  { label: "Complete", path: "/onboarding/complete" },
];
```

Update `app/(app)/layout.tsx` STEP_ROUTES array to match.

Onboarding step numbers shift: departments → step 5, team → step 6, template → step 7, complete → step 8. All `patchOnboardingStep()` calls must be updated accordingly.

**Data migration for existing users:**

Users mid-onboarding have `profiles.onboardingStep` storing an integer index. Inserting a new step 4 shifts all subsequent steps. Apply this SQL migration:

```sql
-- Shift onboarding steps for users who haven't completed onboarding
-- and are past step 3 (where the new vendors-customers step is inserted)
UPDATE profiles
SET onboarding_step = onboarding_step + 1
WHERE is_onboarding_complete = false
  AND onboarding_step >= 4;
```

This migration runs BEFORE deploying the new step routes. Users at step 0-3 are unaffected. Users at step 4+ get shifted to their correct new position.

---

## Phase 5B: Master Data Settings Polish

### Scope

Restyle all 5 master data pages + add CSV/Excel import + add missing fields.

### Shared Pattern for All Master Data Pages

Every master data page follows the same layout:

```
┌──────────────────────────────────────────────────────┐
│  [Icon] Page Title                                    │
│  Description text                                     │
│                                                       │
│  ┌─ Toolbar ───────────────────────────────────────┐  │
│  │ [+ Add New]  [Import CSV/Excel]   🔍 Search    │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ DataTable ─────────────────────────────────────┐  │
│  │ Code | Name | Category | ... | Actions          │  │
│  │ ──── │ ──── │ ──────── │ ─── │ [Edit] [Delete]  │  │
│  │ ...  │ ...  │ ...      │ ... │ ...              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [Pagination]                                         │
└──────────────────────────────────────────────────────┘
```

- **"+ Add New"** opens a Modal with form fields using Input, Select components
- **"Import CSV/Excel"** opens a Modal containing the FileImport component
- **Edit** opens the same Modal pre-filled (update mode)
- **Delete** shows a confirmation Modal
- **Search** filters the DataTable client-side
- All feedback via `useToast()` — no inline messages

### Chart of Accounts Enhancements

**New: Sub-grouping / Account Hierarchy**

Add optional `parentCode` field to COA:
- Top-level accounts have `parentCode: null`
- Sub-accounts reference their parent's code
- DataTable renders indented rows (padding-left based on depth)
- Collapsible groups (click parent row to expand/collapse children)
- **Max depth: 3 levels** (parent → child → grandchild)
- **Circular reference prevention:** server-side validation on save/import — reject if A→B→A chain detected
- **Import validation:** parent codes must reference either existing accounts or other rows in the same import batch

**Schema addition:**
```sql
ALTER TABLE chart_of_accounts ADD COLUMN parent_code TEXT;
```

**Suspense account tooltip:**
Add `<Tooltip content="A suspense account temporarily holds transactions when the correct account is unknown. Entries are moved to the proper account once identified.">` next to the isSuspense toggle.

### Customers Enhancements

**New fields (schema + UI):**
```sql
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN credit_limit NUMERIC(15,2);
```

- Address: textarea in modal
- Credit Limit: CurrencyInput component with ฿ prefix

### Vendors Page

Already has all needed fields from Phase 4B. Just restyle:
- Replace raw HTML table → DataTable
- Replace inline inputs → Modal with Input/Select
- Replace inline buttons → Button component

### Products Page

Restyle + add clarifying description:
> "Products map line item descriptions (from OCR) to GL account codes using keyword matching. When a document is processed, the system checks line item text against product keywords to suggest the correct income or expense account."

### Departments Page

Restyle only — fields are complete (code + name).

---

## Phase 5C: Accounting Settings Polish

### Period Locks

**Current state:** Single text input + "Lock" button.
**Target state:** Full period management view.

```
┌──────────────────────────────────────────────────────┐
│  [Lock] Period Locks                                  │
│  Prevent changes to closed accounting periods.        │
│                                                       │
│  ┌─ DataTable ─────────────────────────────────────┐  │
│  │ Period     | Status   | Locked By | Locked At | │  │
│  │ 2026-03    | 🟢 Open  |           |           │  │
│  │ 2026-02    | 🔒 Locked | John D.  | Mar 15    │  │
│  │ 2026-01    | 🔒 Locked | John D.  | Feb 28    │  │
│  │ 2025-12    | 🔒 Locked | Admin    | Jan 15    │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [Lock Selected Period]                               │
└──────────────────────────────────────────────────────┘
```

**Existing schema (NO changes needed):**

The `period_locks` table already exists in `src/lib/db/schema.ts` (line 409-428):
```typescript
// Row exists = period is locked. DELETE row = unlock.
periodLocks = pgTable("period_locks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  yearMonth: varchar("year_month", { length: 7 }).notNull(), // "YYYY-MM"
  lockedBy: uuid("locked_by").notNull().references(() => profiles.id),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("period_lock_tenant_ym_idx").on(table.tenantId, table.yearMonth)]);
```

Convention: **row exists = locked, DELETE = unlock.** No `is_locked` boolean needed.

Period lock enforcement already exists in several API routes (approve, reject, submit, reversal, payments, batch-approve, documents). Phase 5 only needs the **UI rework**.

**Functional behavior:**
- Auto-generate period list from earliest journal entry to current month
- Periods with a row in `period_locks` show as locked (with lockedBy name + lockedAt date)
- Periods without a row show as open
- Lock: POST `/api/tenants/:id/period-locks` with `{ yearMonth: "YYYY-MM" }` (existing API)
- Unlock: DELETE `/api/tenants/:id/period-locks` with `{ yearMonth: "YYYY-MM" }` (existing API, body-based)
- Unlock requires confirmation Modal ("Unlocking allows changes to posted entries in this period")
- Admin-only actions (enforce via `ensureRole` check)

**Existing enforcement points (already implemented):**
- `POST /api/documents/:id/approve` — checks period lock
- `POST /api/documents/:id/submit` — checks period lock
- `POST /api/documents/:id/reject` — checks period lock
- `POST /api/documents/:id/reversal` — checks period lock
- `POST /api/documents/batch-approve` — checks period lock
- `POST /api/tenants/:id/payments` — checks period lock

**API fix during restyle:** The existing period-locks route exposes raw `error.message` to clients — fix to return generic error message and log server-side (per CLAUDE.md).

### Export Templates

**Current state:** Stub page saying "APIs will be added in next pass."
**Target state:** Template management with CRUD.

```
┌──────────────────────────────────────────────────────┐
│  [FileSpreadsheet] Export Templates                   │
│  Configure column mappings for accounting exports.    │
│                                                       │
│  ┌─ Template Cards ────────────────────────────────┐  │
│  │ ┌─────────────────┐  ┌─────────────────┐       │  │
│  │ │ Default Express  │  │ Custom Template │       │  │
│  │ │ ✓ Active        │  │   Inactive      │       │  │
│  │ │ 12 columns      │  │   8 columns     │       │  │
│  │ │ [Edit] [Preview] │  │ [Edit] [Activate]│      │  │
│  │ └─────────────────┘  └─────────────────┘       │  │
│  │                      [+ Create Template]        │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Schema:**
```sql
CREATE TABLE export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  column_mappings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Column mapping structure:**
```typescript
interface ColumnMapping {
  position: number;       // Column order (1-based)
  header: string;         // Column header text
  sourceField: string;    // Field from journal entry/document
  format?: string;        // Date format, number format, etc.
  defaultValue?: string;  // Fallback value
}
```

**Default Express template columns:**
1. Date, 2. JV Number, 3. Account Code, 4. Account Name, 5. Debit, 6. Credit, 7. Description, 8. Department, 9. Document Number, 10. Document Date, 11. Vendor/Customer, 12. Tax ID

**Template editor:** Modal with column list using up/down arrow buttons for reordering (no DnD library needed). Each row has: position number, header (Input), source field (Select from available fields), format (Input), default value (Input), remove button.

### Bank Reconciliation Settings

**Current state:** Raw date inputs + Run Recon button (basically a debug tool).
**Target state:** Matching rules configuration.

```
┌──────────────────────────────────────────────────────┐
│  [Landmark] Bank Reconciliation Settings              │
│  Configure auto-matching rules and bank accounts.     │
│                                                       │
│  ┌─ Matching Rules Card ───────────────────────────┐  │
│  │ Amount tolerance:  [± ฿ 0.50      ]             │  │
│  │ Date range:        [± 3 days       ]             │  │
│  │ Auto-match:        [Toggle ON      ]             │  │
│  │ Match by reference: [Toggle ON     ]             │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Bank Accounts Card ────────────────────────────┐  │
│  │ Bank   | Account Number | GL Account | Actions   │  │
│  │ KBank  | xxx-x-xxxxx-x | 1110       | [Edit][X] │  │
│  │ SCB    | xxx-x-xxxxx-x | 1120       | [Edit][X] │  │
│  │                         [+ Add Bank Account]     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [Save Settings]                                      │
└──────────────────────────────────────────────────────┘
```

**Schema:**
```sql
CREATE TABLE bank_recon_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  amount_tolerance NUMERIC(10,2) NOT NULL DEFAULT 0.50,
  date_range_days INTEGER NOT NULL DEFAULT 3,
  auto_match BOOLEAN NOT NULL DEFAULT true,
  match_by_reference BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  gl_account_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tax Reports Settings

**Current state:** Raw month input with PP30/PND API calls (debug tool).
**Target state:** Tax configuration page with links to Tax Hub.

```
┌──────────────────────────────────────────────────────┐
│  [ClipboardList] Tax Report Settings                  │
│  Configure tax reporting preferences.                 │
│                                                       │
│  ┌─ Tax Filing Info Card ──────────────────────────┐  │
│  │ Filing frequency:  Monthly (Thai law requires)   │  │
│  │ VAT rate:          7%                            │  │
│  │ WHT default rate:  [Select: 3%      ]            │  │
│  │ Tax ID:            0105524013253 (from workspace) │  │
│  └─────────────────────────────────────────────────┘  │
│  * WHT rate precedence: vendor-specific > workspace   │
│    default > hardcoded 3%                             │
│                                                       │
│  ┌─ Quick Links Card ──────────────────────────────┐  │
│  │ → Tax Report Hub     Generate ภ.พ.30, ภ.ง.ด.    │  │
│  │ → WHT Certificates   Generate 50 ทวิ            │  │
│  │ → VAT Registers      Purchase & Sales VAT       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [Save Settings]                                      │
└──────────────────────────────────────────────────────┘
```

---

## Phase 5D: UX Improvements (User Feedback)

### Buyer Name Mismatch Alert

**Where:** Extraction/preview page, after OCR processes a document.

**Logic:**
1. After OCR extraction, compare `customer.name` (buyer) with `tenants.name` (workspace company)
2. Use fuzzy matching (normalize Thai text, strip suffixes like จำกัด/มหาชน, compare)
3. If similarity < 70%, show a warning banner:

```
⚠️ Buyer name mismatch
OCR detected buyer: "บริษัท ABC จำกัด"
Your workspace: "บริษัท XYZ จำกัด"
This document may have been uploaded to the wrong workspace.
[Dismiss]  [Change Workspace]
```

**Implementation:**
- Add `compareBuyerName(ocrBuyerName: string, tenantName: string): { match: boolean; similarity: number }` to `src/lib/services/buyer-name-matcher.ts`
- **Algorithm:** Token-based Jaccard similarity on normalized names:
  1. Strip Thai suffixes: จำกัด, มหาชน, บริษัท, ห้างหุ้นส่วน, etc.
  2. Strip English suffixes: Co., Ltd., Corp., Inc., etc.
  3. Normalize whitespace, lowercase
  4. Tokenize remaining words
  5. Jaccard similarity = |intersection| / |union| of token sets
  6. Threshold: < 0.5 = mismatch warning
- **Test cases:** "บริษัท ABC จำกัด" vs "ABC Co., Ltd." → match (tokens: {abc}). "บริษัท XYZ จำกัด" vs "ABC Co., Ltd." → mismatch.
- Call during extraction review, display as inline warning banner
- Non-blocking — user can dismiss and continue

### "Create Reversal" Tooltip

**Where:** Approval page, on the "Create Reversal" button.

```tsx
<Tooltip content="Creates a new journal entry that exactly reverses (debits↔credits) the original entry. Used to correct errors in posted entries without deleting them — maintains a complete audit trail.">
  <Button variant="ghost" icon={<RotateCcw />}>Create Reversal</Button>
</Tooltip>
```

### Role Descriptions on Members Page

Add the same role info card from onboarding Step 6 to the workspace members settings page. Place it above the members DataTable as a collapsible info section.

### Invitation Tracking Improvements

The invitations settings page already has: status display, revoke button, date formatting. This is a **restyle + one new feature**:

**Restyle (existing functionality):**
- Replace raw `<table>` → `<DataTable>`
- Replace hardcoded badge colors → `<Badge variant="...">` (pending → draft, accepted → approved, expired → void)
- Replace raw `<input>` / `<select>` / `<button>` → `<Input>` / `<Select>` / `<Button>`
- Replace `window.confirm()` → `<Modal>` for revoke confirmation
- Replace inline message `<p>` → `useToast()`

**New feature: Resend invitation**

Add "Resend" button next to "Revoke" for pending invitations.

API: `POST /api/tenants/:id/invitations/:invitationId/resend`
- Regenerates the invitation token and extends expiry by 7 days
- Re-sends the invitation email via Resend
- Rate limited: max 3 resends per invitation
- Returns `{ success: true, expiresAt: "..." }`

---

## Dependencies & Packages

### New packages needed:
- `papaparse` — CSV parsing (lightweight, handles encoding, MIT license)
- `exceljs` — Excel parsing/writing (MIT license, actively maintained). NOT `xlsx`/SheetJS which has restrictive licensing in recent versions.

### New React Query hooks:
- `src/lib/hooks/use-period-locks.ts` — list, lock, unlock mutations
- `src/lib/hooks/use-export-templates.ts` — CRUD + activate mutation
- `src/lib/hooks/use-bank-recon-settings.ts` — get/update settings
- `src/lib/hooks/use-bank-accounts.ts` — CRUD for bank accounts
- `src/lib/hooks/use-master-data-import.ts` — shared import mutation (POST batch to entity API)

### Existing packages (no additions):
- All UI components already exist in `src/components/`
- Drizzle ORM for schema migrations
- React Query for data fetching hooks

---

## Schema Migration Summary

```sql
-- Phase 5A: Onboarding step shift (run BEFORE deploying new routes)
UPDATE profiles
SET onboarding_step = onboarding_step + 1
WHERE is_onboarding_complete = false
  AND onboarding_step >= 4;

-- Phase 5B: Master data enhancements
ALTER TABLE chart_of_accounts ADD COLUMN parent_code TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN credit_limit NUMERIC(15,2);

-- Phase 5C: Accounting settings (period_locks already exists — no changes)
CREATE TABLE export_templates (...);
CREATE TABLE bank_recon_settings (...);
CREATE TABLE bank_accounts (...);
```

Total: 3 new tables, 3 new columns, 1 data migration.

---

## File Impact Estimate

### Phase 5A (Onboarding)
- **New:** `src/components/file-import.tsx`, `src/app/(onboarding)/onboarding/vendors-customers/page.tsx`
- **Modified:** All 7 existing onboarding pages + layout.tsx, `src/app/(app)/layout.tsx` (STEP_ROUTES)

### Phase 5B (Master Data Settings)
- **Modified:** 5 master data pages (coa, vendors, customers, products, departments)
- **New:** API routes for import endpoints, migration file

### Phase 5C (Accounting Settings)
- **Modified:** 4 accounting settings pages
- **New:** period_locks queries/hooks/API, export_templates queries/hooks/API, bank_recon_settings queries/hooks/API, bank_accounts queries/hooks/API, migration file

### Phase 5D (UX Improvements)
- **New:** `src/lib/services/buyer-name-matcher.ts`
- **Modified:** Extraction page (mismatch alert), approval page (reversal tooltip), members page (role descriptions), invitations page (resend/revoke)

---

## Environment Separation

Phase 5 development uses a **separate staging Supabase project** to avoid impacting production.

**Setup:**
- `.env.local` → staging Supabase project (dev/test)
- `.env.production` → prod Supabase project (backup reference, gitignored)
- All migrations tested on staging first, then applied to prod at deployment

**Service separation:**
| Service | Prod | Staging |
|---------|------|---------|
| Supabase | `kgsgthkwjcpiiisnmcxh` | `<staging-project-id>` |
| Inngest | Prod keys | Dev mode keys |
| Resend | Prod key | Test key (no real emails) |
| Google Vision | Shared (stateless API) | Same key OK |
| Upstash Redis | Prod (optional) | Skip (use in-process fallback) |

**Deployment flow:**
1. Develop + test on staging
2. Run all migrations on staging, verify
3. Deploy app to Vercel preview branch
4. When ready: apply migrations to prod, deploy to prod

---

## Out of Scope

- OCR accuracy improvements (Phase 6 — AI)
- Thai calendar conversion fixes (Phase 6 — AI)
- Cash vs credit purchase journal auto-routing (Phase 6 — AI suggestion)
- ภ.ง.ด.1/1ก employee WHT (requires payroll module)
- E-filing integration with rd.go.th
- Email certificates to vendors
