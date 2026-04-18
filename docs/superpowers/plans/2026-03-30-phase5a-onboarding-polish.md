# Phase 5A: Onboarding Polish + Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all onboarding pages to use design system components, add CSV/Excel import for master data, add vendors/customers step, add product hint.

**Architecture:** Build a shared `FileImport` component (CSV via papaparse, Excel via exceljs) with column-mapping preview. Add batch insert API endpoints. Restyle each onboarding step to use `Button`, `Input`, `Select`, `Card`, `DataTable`, `Tabs` from `src/components/`. Add new `/onboarding/vendors-customers` page with tabbed layout.

**Tech Stack:** Next.js 16 App Router, React 19, papaparse, exceljs, existing design system components

**Spec:** `docs/superpowers/specs/2026-03-30-phase5-settings-polish-design.md` (Phase 5A section)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/file-import.tsx` | Shared CSV/Excel import component with drag-drop, column mapping, validation |
| `src/app/(onboarding)/onboarding/vendors-customers/page.tsx` | New step 4: tabbed vendors/customers entry with import |
| `src/app/api/tenants/[id]/coa/batch/route.ts` | Batch insert API for COA (import) |
| `src/app/api/tenants/[id]/vendors/batch/route.ts` | Batch insert API for vendors (import) |
| `src/app/api/tenants/[id]/customers/batch/route.ts` | Batch insert API for customers (import) |
| `src/app/api/tenants/[id]/departments/batch/route.ts` | Batch insert API for departments (import) |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(onboarding)/layout.tsx` | Add step 4 to STEPS array, restyle to CSS vars |
| `src/app/(onboarding)/onboarding/page.tsx` | Restyle welcome page to design system components |
| `src/app/(onboarding)/onboarding/workspace/page.tsx` | Restyle to `Button`, `Input` |
| `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx` | Restyle + add FileImport toggle |
| `src/app/(onboarding)/onboarding/departments/page.tsx` | Restyle + add FileImport toggle, update step number (4→5) |
| `src/app/(onboarding)/onboarding/team/page.tsx` | Restyle + add role descriptions card, update step number (5→6) |
| `src/app/(onboarding)/onboarding/template/page.tsx` | Restyle, update step number (6→7) |
| `src/app/(onboarding)/onboarding/complete/page.tsx` | Restyle + add product hint, update step number (7→8) |
| `src/app/(app)/layout.tsx` | Update STEP_ROUTES array for new step |
| `package.json` | Add papaparse, exceljs dependencies |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install papaparse and exceljs**

```bash
npm install papaparse exceljs
npm install -D @types/papaparse
```

- [ ] **Step 2: Verify install succeeds**

Run: `npm ls papaparse exceljs`
Expected: Both packages listed without errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add papaparse and exceljs for CSV/Excel import"
```

---

## Task 2: Data migration for existing users

**Files:**
- Create: new Drizzle migration file (via `npx drizzle-kit generate`)

- [ ] **Step 1: Create a SQL migration for onboarding step shift**

Create file `supabase/migrations/XXXX_shift_onboarding_steps.sql` (use `npx drizzle-kit generate` for auto-naming):

```sql
-- Shift onboarding steps for users mid-onboarding.
-- New step 3 (vendors-customers) is inserted, pushing subsequent steps +1.
UPDATE profiles
SET onboarding_step = onboarding_step + 1
WHERE is_onboarding_complete = false
  AND onboarding_step >= 3;
```

Note: This migration must run BEFORE deploying the new STEP_ROUTES. On staging, run manually via Supabase SQL editor or `npx drizzle-kit push`.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "chore: add migration to shift onboarding steps for new vendors-customers step"
```

---

## Task 3: Build FileImport component

**Files:**
- Create: `src/components/file-import.tsx`

- [ ] **Step 1: Create the FileImport component**

This is the core shared component. It handles:
- Drag-drop or click file selection (.csv, .xlsx, .xls)
- Client-side parsing via papaparse (CSV) or exceljs (Excel)
- Auto-column-mapping by header name matching
- Manual column reassignment via Select dropdowns
- Validation (required fields, duplicates, row/file limits)
- Preview first 5 rows in a table
- Import button that calls `onImport` with validated rows

```tsx
"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/button";
import { Select } from "@/components/select";

// --- Types ---

export type EntityType = "coa" | "vendor" | "customer" | "department" | "product";

interface ColumnDef {
  key: string;
  label: string;
  required: boolean;
}

interface FileImportProps {
  entityType: EntityType;
  onImport: (rows: Record<string, string>[]) => void | Promise<void>;
  maxRows?: number;
}

// --- Column definitions per entity ---

const COLUMN_DEFS: Record<EntityType, ColumnDef[]> = {
  coa: [
    { key: "accountCode", label: "Account Code", required: true },
    { key: "accountName", label: "Account Name", required: true },
    { key: "category", label: "Category", required: true },
    { key: "isSuspense", label: "Suspense", required: false },
    { key: "parentCode", label: "Parent Code", required: false },
  ],
  vendor: [
    { key: "taxId", label: "Tax ID", required: true },
    { key: "name", label: "Name", required: true },
    { key: "address", label: "Address", required: false },
    { key: "vendorType", label: "Type (company/individual)", required: false },
    { key: "branchNumber", label: "Branch Number", required: false },
    { key: "country", label: "Country", required: false },
    { key: "isNonResident", label: "Non-Resident", required: false },
    { key: "defaultExpenseGl", label: "Default Expense GL", required: false },
    { key: "defaultWhtRate", label: "Default WHT Rate", required: false },
  ],
  customer: [
    { key: "taxId", label: "Tax ID", required: true },
    { key: "name", label: "Name", required: true },
    { key: "address", label: "Address", required: false },
    { key: "creditTermDays", label: "Credit Term Days", required: false },
    { key: "creditLimit", label: "Credit Limit", required: false },
    { key: "branchNumber", label: "Branch Number", required: false },
  ],
  department: [
    { key: "deptCode", label: "Department Code", required: true },
    { key: "deptName", label: "Department Name", required: true },
  ],
  product: [
    { key: "itemCode", label: "Item Code", required: true },
    { key: "itemName", label: "Item Name", required: true },
    { key: "keywords", label: "Keywords", required: false },
    { key: "incomeGl", label: "Income GL", required: false },
    { key: "expenseGl", label: "Expense GL", required: false },
  ],
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function FileImport({ entityType, onImport, maxRows = 5000 }: FileImportProps) {
  // ... Component implementation
  // States: file, parsedHeaders, parsedRows, columnMapping, errors, importing
  // 1. Drop zone with Upload icon
  // 2. After file selected: parse with papaparse/exceljs
  // 3. Show column mapping: each entity column → Select with file headers
  // 4. Auto-map by fuzzy header matching (lowercase includes)
  // 5. Show preview table (first 5 rows)
  // 6. Show validation: X errors, Y warnings, Z rows ready
  // 7. Import button → maps rows using columnMapping → calls onImport
}
```

Full implementation: the component should be ~200 lines. Key behaviors:

**Drop zone:** `<div>` with `onDragOver`/`onDrop` handlers and hidden `<input type="file" accept=".csv,.xlsx,.xls">`. Styled with dashed border using `border-[var(--border)]`, hover state `border-[var(--primary)]`.

**File parsing:**
```tsx
async function parseFile(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    setErrors(["File exceeds 5MB limit"]);
    return;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    const Papa = (await import("papaparse")).default;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        handleParsed(result.meta.fields ?? [], result.data as Record<string, string>[]);
      },
    });
  } else {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) {
        row.eachCell((cell) => headers.push(String(cell.value ?? "")));
      } else {
        const obj: Record<string, string> = {};
        row.eachCell((cell, colNum) => {
          obj[headers[colNum - 1]] = String(cell.value ?? "");
        });
        rows.push(obj);
      }
    });
    handleParsed(headers, rows);
  }
}
```

**Auto-mapping:** For each `ColumnDef`, find the first file header where `header.toLowerCase().includes(def.key.toLowerCase())` or `header.toLowerCase().includes(def.label.toLowerCase())`.

**Validation:** Check required columns are mapped, check row count <= maxRows, check required fields are non-empty per row.

- [ ] **Step 2: Verify component renders without errors**

Import it temporarily in any page, confirm no build errors:
```bash
npx next build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/file-import.tsx
git commit -m "feat: add FileImport component for CSV/Excel import with column mapping"
```

---

## Task 4: Batch insert API endpoints

**Files:**
- Create: `src/app/api/tenants/[id]/coa/batch/route.ts`
- Create: `src/app/api/tenants/[id]/vendors/batch/route.ts`
- Create: `src/app/api/tenants/[id]/customers/batch/route.ts`
- Create: `src/app/api/tenants/[id]/departments/batch/route.ts`

No existing `bulk` endpoints exist — these are net-new. All follow the same pattern with proper auth:

- [ ] **Step 1: Create COA batch endpoint**

```tsx
// src/app/api/tenants/[id]/coa/batch/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chartOfAccounts } from "@/lib/db/schema";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");

  try {
    const { rows } = (await request.json()) as {
      rows: Array<{
        accountCode: string;
        accountName: string;
        category: string;
        isSuspense?: boolean;
        parentCode?: string;
      }>;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: "No rows provided" }, { status: 400 });
    }
    if (rows.length > 5000) {
      return NextResponse.json({ success: false, error: "Maximum 5000 rows per import" }, { status: 400 });
    }

    const values = rows.map((r) => ({
      tenantId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      category: r.category as "asset" | "liability" | "equity" | "revenue" | "expense",
      isSuspense: Boolean(r.isSuspense),
    }));

    const inserted = await db.insert(chartOfAccounts).values(values).returning();
    return NextResponse.json({ success: true, data: { count: inserted.length } }, { status: 201 });
  } catch (error) {
    console.error("COA batch import error:", error);
    return NextResponse.json({ success: false, error: "Failed to import accounts" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create vendors batch endpoint**

Same pattern, fields: `taxId, name, address, vendorType, branchNumber, country, isNonResident, defaultExpenseGl, defaultWhtRate`.

File: `src/app/api/tenants/[id]/vendors/batch/route.ts`

- [ ] **Step 3: Create customers batch endpoint**

Same pattern, fields: `taxId, name, address, creditTermDays, branchNumber`.

File: `src/app/api/tenants/[id]/customers/batch/route.ts`

- [ ] **Step 4: Create departments batch endpoint**

Same pattern, fields: `deptCode, deptName`.

File: `src/app/api/tenants/[id]/departments/batch/route.ts`

- [ ] **Step 5: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tenants/[id]/coa/batch/route.ts src/app/api/tenants/[id]/vendors/batch/route.ts src/app/api/tenants/[id]/customers/batch/route.ts src/app/api/tenants/[id]/departments/batch/route.ts
git commit -m "feat: add batch import API endpoints for COA, vendors, customers, departments"
```

---

## Task 5: Restyle onboarding layout

**Files:**
- Modify: `src/app/(onboarding)/layout.tsx`

- [ ] **Step 1: Update STEPS array to include new vendors-customers step**

```tsx
const STEPS = [
  { label: "Welcome", path: "/onboarding" },
  { label: "Workspace", path: "/onboarding/workspace" },
  { label: "Accounts", path: "/onboarding/chart-of-accounts" },
  { label: "Partners", path: "/onboarding/vendors-customers" },
  { label: "Departments", path: "/onboarding/departments" },
  { label: "Team", path: "/onboarding/team" },
  { label: "Template", path: "/onboarding/template" },
  { label: "Complete", path: "/onboarding/complete" },
];
```

- [ ] **Step 2: Restyle layout to use CSS variables**

Replace hardcoded colors:
- `bg-slate-50` → `bg-[var(--background)]`
- `border-slate-200` → `border-[var(--border)]`
- `bg-blue-600` → `bg-[var(--primary)]`
- `text-slate-900` → `text-[var(--foreground)]`
- `text-slate-400` → `text-[var(--muted-foreground)]`
- `border-blue-600` → `border-[var(--primary)]`
- `border-slate-300` → `border-[var(--border)]`

- [ ] **Step 3: Update STEP_ROUTES in app layout**

File: `src/app/(app)/layout.tsx` — update the STEP_ROUTES array (line 63-71):

```tsx
const STEP_ROUTES = [
  "/onboarding",
  "/onboarding/workspace",
  "/onboarding/chart-of-accounts",
  "/onboarding/vendors-customers",
  "/onboarding/departments",
  "/onboarding/team",
  "/onboarding/template",
  "/onboarding/complete",
];
```

- [ ] **Step 4: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(onboarding)/layout.tsx src/app/(app)/layout.tsx
git commit -m "feat: update onboarding layout with new Partners step and CSS variable styling"
```

---

## Task 6: Restyle Welcome page

**Files:**
- Modify: `src/app/(onboarding)/onboarding/page.tsx`

- [ ] **Step 1: Replace raw button with Button component**

Import `Button` from `@/components/button`. Replace the inline `<button>` with:
```tsx
<Button variant="primary" size="lg" loading={loading} icon={<ArrowRight className="h-4 w-4" />} onClick={handleStart}>
  Let's get started
</Button>
```

- [ ] **Step 2: Replace hardcoded colors with CSS variables**

- `text-slate-900` → `text-[var(--foreground)]`
- `text-slate-600` → `text-[var(--muted-foreground)]`
- `text-slate-500` → `text-[var(--muted-foreground)]`
- `border-slate-200` → `border-[var(--border)]`
- `bg-blue-50` → `bg-[var(--primary-light)]`
- `text-blue-600` → `text-[var(--primary)]`
- `shadow-sm` → `shadow-[var(--shadow-sm)]`

- [ ] **Step 3: Verify page renders**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(onboarding)/onboarding/page.tsx
git commit -m "refactor: restyle onboarding welcome page with design system components"
```

---

## Task 7: Restyle Workspace page

**Files:**
- Modify: `src/app/(onboarding)/onboarding/workspace/page.tsx`

- [ ] **Step 1: Import and use design system components**

Replace raw inputs with `<Input>` and raw buttons with `<Button>`:

```tsx
import { Button } from "@/components/button";
import { Input } from "@/components/input";
```

Key replacements:
- Company name `<input>` → `<Input label="Company Name" required placeholder="e.g. บริษัท ตัวอย่าง จำกัด" />`
- Tax ID `<input>` → `<Input label="Tax ID" helperText="13 digits (optional)" />`
- Back button → `<Button variant="secondary" icon={<ArrowLeft />}>Back</Button>`
- Next button → `<Button variant="primary" loading={loading} icon={<ArrowRight />}>Next</Button>`
- Error div → use `error` prop on Input or keep as a styled alert with `var(--destructive-light)`

- [ ] **Step 2: Replace all hardcoded colors with CSS variables**

Same pattern as Task 5 Step 2.

- [ ] **Step 3: Remove Building2 icon from input (keep it simpler with Input component label)**

The Input component handles labels natively — no need for the icon-inside-input pattern.

- [ ] **Step 4: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(onboarding)/onboarding/workspace/page.tsx
git commit -m "refactor: restyle onboarding workspace page with Input and Button components"
```

---

## Task 8: Restyle Chart of Accounts page + add import

**Files:**
- Modify: `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx`

This is the most complex onboarding page — it gets both restyling AND import capability.

- [ ] **Step 1: Add import mode toggle**

Add a state `mode: "manual" | "import"` with two buttons at the top of the form card:

```tsx
const [mode, setMode] = useState<"manual" | "import">("manual");

// In JSX, above the form:
<div className="flex gap-2 mb-4">
  <Button
    variant={mode === "manual" ? "primary" : "secondary"}
    size="sm"
    onClick={() => setMode("manual")}
  >
    Manual Entry
  </Button>
  <Button
    variant={mode === "import" ? "primary" : "secondary"}
    size="sm"
    onClick={() => setMode("import")}
  >
    Import File
  </Button>
</div>
```

- [ ] **Step 2: Add FileImport in import mode**

```tsx
import { FileImport } from "@/components/file-import";

// When mode === "import":
<FileImport
  entityType="coa"
  onImport={async (rows) => {
    const res = await fetch(`/api/tenants/${tenantId}/coa/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
      body: JSON.stringify({ rows }),
    });
    const json = await res.json();
    if (json.success) {
      setCoaRows((prev) => [...prev, ...rows.map(r => ({
        accountCode: r.accountCode,
        accountName: r.accountName,
        category: r.category,
      }))]);
      setMode("manual"); // Switch back to show the table
    }
  }}
/>
```

- [ ] **Step 3: Restyle manual entry form**

Replace raw inputs with `<Input>`, raw select with `<Select>`, raw button with `<Button>`:

```tsx
import { Input } from "@/components/input";
import { Select } from "@/components/select";

// Category select:
<Select
  label="Category"
  options={[
    { value: "asset", label: "Asset" },
    { value: "liability", label: "Liability" },
    { value: "equity", label: "Equity" },
    { value: "revenue", label: "Revenue" },
    { value: "expense", label: "Expense" },
  ]}
  value={category}
  onChange={setCategory}
/>
```

- [ ] **Step 4: Replace hardcoded table with DataTable or keep styled table with CSS vars**

The existing table is simple enough — just replace hardcoded colors. Keep the table structure but use CSS vars:
- `bg-slate-50` → `bg-[var(--muted)]`
- `text-slate-500` → `text-[var(--muted-foreground)]`
- `text-slate-700` → `text-[var(--foreground)]`
- `divide-slate-100` → `divide-[var(--border)]`
- `hover:bg-slate-50` → `hover:bg-[var(--muted)]`
- `hover:bg-red-50 hover:text-red-600` → `hover:bg-[var(--destructive-light)] hover:text-[var(--destructive)]`

- [ ] **Step 5: Update step number and navigation target**

The COA page currently calls `patchOnboardingStep(3)` and navigates to `/onboarding/departments`. After the new step insertion:
- Change `patchOnboardingStep(3)` → keep as `patchOnboardingStep(3)` (vendors-customers is now index 3 — this is correct!)
- Change `router.push("/onboarding/departments")` → `router.push("/onboarding/vendors-customers")`
- Change back link from `/onboarding/workspace` (unchanged)
- Update `handleSkip` navigation: also change to `/onboarding/vendors-customers`

- [ ] **Step 6: Replace navigation buttons with Button component**

Back, Skip, Next — same pattern as Task 7.

- [ ] **Step 7: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx
git commit -m "feat: add CSV/Excel import to onboarding COA page and restyle with design system"
```

---

## Task 9: Create Vendors & Customers page (NEW step 4)

**Files:**
- Create: `src/app/(onboarding)/onboarding/vendors-customers/page.tsx`

- [ ] **Step 1: Create the page with tabbed layout**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Store, UserSquare2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Tabs } from "@/components/tabs";
import { FileImport } from "@/components/file-import";

export default function OnboardingVendorsCustomersPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [activeTab, setActiveTab] = useState("vendors");
  const [mode, setMode] = useState<"manual" | "import">("manual");
  // ... vendor state, customer state, loading, error

  useEffect(() => {
    const tid = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(tid);
  }, []);

  // Vendor manual add, customer manual add, import handlers...

  async function patchOnboardingStep(step: number) {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: step }),
    });
  }

  async function saveAndNext() {
    // Save vendors + customers via batch APIs
    await patchOnboardingStep(4); // departments is now at index 4
    router.push("/onboarding/departments");
  }

  async function handleSkip() {
    await patchOnboardingStep(4);
    router.push("/onboarding/departments");
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)]">
          <Store className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Vendors & Customers</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Add your business partners for AP/AR tracking</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8">
        <Tabs
          tabs={[
            { label: "Vendors", value: "vendors" },
            { label: "Customers", value: "customers" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Content card */}
      <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <Button variant={mode === "manual" ? "primary" : "secondary"} size="sm" onClick={() => setMode("manual")}>
            Manual Entry
          </Button>
          <Button variant={mode === "import" ? "primary" : "secondary"} size="sm" onClick={() => setMode("import")}>
            Import File
          </Button>
        </div>

        {mode === "import" ? (
          <FileImport
            entityType={activeTab === "vendors" ? "vendor" : "customer"}
            onImport={async (rows) => { /* batch API call */ }}
          />
        ) : (
          /* Manual entry form — vendor fields or customer fields based on activeTab */
          activeTab === "vendors" ? (
            /* Vendor form: Name, Tax ID, Type (Select), Branch, Address, WHT Rate */
            <div>...</div>
          ) : (
            /* Customer form: Name, Tax ID, Branch, Address, Credit Terms */
            <div>...</div>
          )
        )}

        {/* Data table showing added rows */}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push("/onboarding/chart-of-accounts")}>
          Back
        </Button>
        <Button variant="link" onClick={handleSkip}>I'll do this later</Button>
        <Button variant="primary" loading={false} icon={<ArrowRight className="h-4 w-4" />} onClick={saveAndNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement vendor manual entry form**

Fields using `<Input>` and `<Select>`:
- Name (required), Tax ID (required, 13-digit validation)
- Type: `<Select>` with options `[{value: "company", label: "Company"}, {value: "individual", label: "Individual"}]`
- Branch Number (optional), Address (optional)
- Default WHT Rate: `<Select>` with options `1%, 2%, 3%, 5%, 10%, 15%`
- Non-resident: checkbox or Toggle component

- [ ] **Step 3: Implement customer manual entry form**

Fields:
- Name (required), Tax ID (required, 13-digit validation)
- Branch Number (optional), Address (optional)
- Credit Term Days (optional, number input)

- [ ] **Step 4: Add data tables showing added vendors/customers**

Use simple table with CSS vars (same pattern as COA onboarding table). Show rows with remove button.

- [ ] **Step 5: Wire up import handlers**

Each tab's import calls the respective batch API endpoint (`/api/tenants/${tenantId}/vendors/batch` or `/customers/batch`).

- [ ] **Step 6: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add src/app/(onboarding)/onboarding/vendors-customers/page.tsx
git commit -m "feat: add onboarding vendors & customers step with manual entry and CSV/Excel import"
```

---

## Task 10: Restyle Departments page + add import

**Files:**
- Modify: `src/app/(onboarding)/onboarding/departments/page.tsx`

- [ ] **Step 1: Update onboarding step number and back link**

Change `patchOnboardingStep(4)` → `patchOnboardingStep(5)` in `saveAndNext` and `handleSkip` (team is now at index 5).
Change back link from `/onboarding/chart-of-accounts` → `/onboarding/vendors-customers`.
Change next route to `/onboarding/team` (unchanged).

- [ ] **Step 2: Add import mode toggle + FileImport**

Same pattern as COA page (Task 7): mode state, toggle buttons, `<FileImport entityType="department" onImport={...} />`.

- [ ] **Step 3: Restyle to design system components**

Replace raw inputs → `<Input>`, raw buttons → `<Button>`, hardcoded colors → CSS vars.

- [ ] **Step 4: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(onboarding)/onboarding/departments/page.tsx
git commit -m "refactor: restyle departments onboarding with import support and design system components"
```

---

## Task 11: Restyle Team page + add role descriptions

**Files:**
- Modify: `src/app/(onboarding)/onboarding/team/page.tsx`

- [ ] **Step 1: Update onboarding step number**

Change `patchOnboardingStep(5)` → `patchOnboardingStep(6)` in `handleNext` and `handleSkip` (template is now at index 6).
Back link unchanged (departments).

- [ ] **Step 2: Add role descriptions card**

Above the invite form, add:

```tsx
import { User, CheckCircle2, KeyRound } from "lucide-react";

<div className="mt-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Roles</h3>
  <div className="space-y-3">
    <div className="flex items-start gap-3">
      <User className="h-4 w-4 text-[var(--primary)] mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">Maker</p>
        <p className="text-xs text-[var(--muted-foreground)]">Upload documents, edit extractions, create journal entries, record payments.</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <CheckCircle2 className="h-4 w-4 text-[var(--success)] mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">Checker</p>
        <p className="text-xs text-[var(--muted-foreground)]">Review & approve documents, post journal entries, generate reports and certificates.</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <KeyRound className="h-4 w-4 text-[var(--warning)] mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">Admin (workspace creator)</p>
        <p className="text-xs text-[var(--muted-foreground)]">Full access including settings, master data, member management, and workspace deletion.</p>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Restyle invite form**

Replace raw `<input>` → `<Input>`, raw `<select>` → `<Select>`, raw `<button>` → `<Button>`. Replace hardcoded colors → CSS vars.

- [ ] **Step 4: Restyle invitations list**

Replace hardcoded badge colors (`bg-slate-100 text-slate-700`) with CSS var equivalents.

- [ ] **Step 5: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/app/(onboarding)/onboarding/team/page.tsx
git commit -m "feat: add role descriptions and restyle team onboarding page"
```

---

## Task 12: Restyle Template page

**Files:**
- Modify: `src/app/(onboarding)/onboarding/template/page.tsx`

- [ ] **Step 1: Update onboarding step number**

Change `patchOnboardingStep(6)` → `patchOnboardingStep(7)` in `handleNext` (complete is now at index 7).
Back link: `/onboarding/team` (unchanged).

- [ ] **Step 2: Restyle to design system components**

Replace all hardcoded colors with CSS vars. Replace raw buttons with `<Button>`. Keep the radio card pattern but use CSS vars:
- `border-blue-500 bg-blue-50` → `border-[var(--primary)] bg-[var(--primary-light)]`
- `border-slate-200` → `border-[var(--border)]`
- Raw `<input type="radio">` — keep native but add `accent-[var(--primary)]`

- [ ] **Step 3: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(onboarding)/onboarding/template/page.tsx
git commit -m "refactor: restyle template onboarding page with CSS variables"
```

---

## Task 13: Restyle Complete page + add product hint

**Files:**
- Modify: `src/app/(onboarding)/onboarding/complete/page.tsx`

- [ ] **Step 1: Add product hint card**

```tsx
import { CheckCircle2, ArrowRight, Lightbulb, Package } from "lucide-react";
import { Button } from "@/components/button";

// After the "You're all set" message, before the buttons:
<div className="mt-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--info-light)] p-4">
  <div className="flex items-start gap-3">
    <Lightbulb className="h-5 w-5 text-[var(--primary)] mt-0.5 shrink-0" />
    <div>
      <p className="text-sm font-medium text-[var(--foreground)]">Speed up document processing</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Set up Products in Settings → Master Data to auto-map line items to GL accounts.
      </p>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add two action buttons**

Replace the single raw button with:

```tsx
<div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
  <Button variant="primary" loading={completing} onClick={handleComplete} icon={<ArrowRight className="h-4 w-4" />}>
    Go to Dashboard
  </Button>
  <Button variant="ghost" onClick={() => router.push("/settings/masterdata/products")} icon={<Package className="h-4 w-4" />}>
    Set up Products
  </Button>
</div>
```

- [ ] **Step 3: Replace hardcoded colors with CSS vars**

- `bg-green-50` → `bg-[var(--success-light)]`
- `text-green-600` → `text-[var(--success)]`
- All other colors as per pattern.

- [ ] **Step 4: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(onboarding)/onboarding/complete/page.tsx
git commit -m "feat: add product hint and restyle complete onboarding page"
```

---

## Task 14: Final verification + integration commit

- [ ] **Step 1: Full build check**

```bash
npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify onboarding flow navigation**

Manually trace the flow logic:
- Layout STEPS has 8 entries (indices 0-7)
- `app/(app)/layout.tsx` STEP_ROUTES has 8 matching entries
- Each page's `patchOnboardingStep()` sets the index of the NEXT page:
  - Welcome → 1, Workspace → 2, COA → 3, Vendors/Customers → 4, Departments → 5, Team → 6, Template → 7, Complete → sets `isOnboardingComplete: true, onboardingStep: 7`
- Each page's back/next links point to correct routes

- [ ] **Step 3: Check no hardcoded colors remain in onboarding pages**

```bash
grep -r "bg-blue-600\|bg-slate-900\|border-slate-300\|text-slate-" src/app/\(onboarding\)/ --include="*.tsx" | head -20
```
Expected: No matches (all replaced with CSS vars)

- [ ] **Step 4: Final commit if any fixes needed**

Stage only the specific files that were changed:
```bash
git add src/app/(onboarding)/ src/app/(app)/layout.tsx src/components/file-import.tsx
git commit -m "fix: resolve any remaining onboarding style inconsistencies"
```
