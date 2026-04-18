# Phase 5B: Master Data Settings Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all 5 master data settings pages to use design system components, add CSV/Excel import via FileImport, add modal-based create/edit (replacing inline table editing), add suspense account tooltip.

**Architecture:** Each page follows the same pattern: page header → toolbar (Add New + Import + Search) → DataTable → Modal for create/edit. Reuse FileImport component from Phase 5A and batch endpoints. Replace all inline `<input>/<select>/<button>` with `Button/Input/Select/Modal/DataTable` components. Replace `message` state feedback with `useToast()`.

**Tech Stack:** Existing design system components, batch API endpoints from Phase 5A, `useToast()` from ui-store

**Spec:** `docs/superpowers/specs/2026-03-30-phase5-settings-polish-design.md` (Phase 5B section)

---

## Shared Pattern for All 5 Pages

Each master data settings page will follow this structure:

```
<section className="space-y-6">
  {/* Page header */}
  <div className="flex items-center gap-3">
    <Icon className="h-6 w-6 text-[var(--muted-foreground)]" />
    <div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Title</h1>
      <p className="text-sm text-[var(--muted-foreground)]">Description</p>
    </div>
  </div>

  {/* Toolbar */}
  <div className="flex flex-wrap items-center gap-2">
    <Button icon={<Plus />} onClick={() => setModalOpen(true)}>Add New</Button>
    <Button variant="secondary" icon={<Upload />} onClick={() => setImportOpen(true)}>Import</Button>
    <div className="ml-auto">
      <Input placeholder="Search..." value={search} onChange={...} />
    </div>
  </div>

  {/* DataTable */}
  <DataTable columns={columns} data={filtered} ... />

  {/* Create/Edit Modal */}
  <Modal open={modalOpen} onClose={...} title="Add/Edit" actions={...}>
    {/* Form fields using Input/Select */}
  </Modal>

  {/* Import Modal */}
  <Modal open={importOpen} onClose={...} title="Import" size="lg">
    <FileImport entityType="..." onImport={...} />
  </Modal>
</section>
```

Key changes from current pages:
- Inline table editing → Modal-based create/edit
- Raw `<table>` → `<DataTable>` component
- `message` state → `useToast()`
- Raw inputs/buttons → `Input`/`Select`/`Button` components
- Hardcoded colors → CSS variables
- No search → client-side search filter

---

## Task 1: Restyle COA Settings Page

**Files:**
- Modify: `src/app/(app)/settings/masterdata/coa/page.tsx`

- [ ] **Step 1: Complete rewrite of the COA settings page**

Replace the entire page with the new pattern:
- Page header: BookOpen icon, "Chart of Accounts", "Manage your account codes and categories"
- Toolbar: Add New + Import + Search
- DataTable with columns: Code, Name, Category (Badge), Suspense (yes/no), Actions (Edit/Delete)
- Create/Edit Modal: accountCode (Input, disabled on edit), accountName (Input), category (Select), isSuspense (Toggle + Tooltip explaining suspense accounts)
- Import Modal: FileImport entityType="coa" with batch endpoint
- Delete: confirmation Modal
- Suspense tooltip: "A suspense account temporarily holds transactions when the correct account is unknown. Entries are moved to the proper account once identified."
- DataTable row type needs `[key: string]: unknown` index signature
- Use `useToast()` for success/error feedback
- Client-side search filters by accountCode or accountName

Components to import:
```tsx
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Toggle } from "@/components/toggle";
import { Tooltip } from "@/components/tooltip";
import { FileImport } from "@/components/file-import";
import { useToast } from "@/lib/stores/ui-store";
```

- [ ] **Step 2: Verify no hardcoded colors remain**
- [ ] **Step 3: Verify build passes**
- [ ] **Step 4: Commit**

---

## Task 2: Restyle Vendors Settings Page

**Files:**
- Modify: `src/app/(app)/settings/masterdata/vendors/page.tsx`

- [ ] **Step 1: Complete rewrite of the vendors settings page**

Same pattern as COA:
- Page header: Store icon, "Vendors", "Manage vendor master data for accounts payable and WHT"
- DataTable columns: Name, Tax ID, Type (Badge), Branch, WHT Rate, Actions
- Create/Edit Modal fields: name (Input required), taxId (Input required, maxLength 13), vendorType (Select: company/individual), branchNumber (Input), address (Input), country (Input), isNonResident (Toggle), defaultExpenseGl (Input), defaultWhtRate (Select: 1%/2%/3%/5%/10%/15%)
- Import Modal: FileImport entityType="vendor"
- Delete confirmation Modal
- useToast() for feedback

- [ ] **Step 2: Verify no hardcoded colors remain**
- [ ] **Step 3: Verify build passes**
- [ ] **Step 4: Commit**

---

## Task 3: Restyle Customers Settings Page

**Files:**
- Modify: `src/app/(app)/settings/masterdata/customers/page.tsx`

- [ ] **Step 1: Complete rewrite of the customers settings page**

Same pattern:
- Page header: UserSquare2 icon, "Customers", "Manage customer master data for accounts receivable"
- DataTable columns: Name, Tax ID, Branch, Credit Terms, Actions
- Create/Edit Modal fields: name (Input required), taxId (Input required, maxLength 13), branchNumber (Input), creditTermDays (Input type number)
- Import Modal: FileImport entityType="customer"
- Delete confirmation Modal
- useToast() for feedback

- [ ] **Step 2: Verify no hardcoded colors remain**
- [ ] **Step 3: Verify build passes**
- [ ] **Step 4: Commit**

---

## Task 4: Restyle Products Settings Page

**Files:**
- Modify: `src/app/(app)/settings/masterdata/products/page.tsx`

- [ ] **Step 1: Complete rewrite of the products settings page**

Same pattern:
- Page header: Package icon, "Products", description: "Products map line item descriptions (from OCR) to GL account codes using keyword matching. When a document is processed, the system checks line item text against product keywords to suggest the correct income or expense account."
- DataTable columns: Code, Name, Keywords, Income GL, Expense GL, Actions
- Create/Edit Modal fields: itemCode (Input required), itemName (Input required), keywords (Input, comma-separated), incomeGl (Input), expenseGl (Input)
- Import Modal: FileImport entityType="product"
- Delete confirmation Modal
- useToast() for feedback

- [ ] **Step 2: Verify no hardcoded colors remain**
- [ ] **Step 3: Verify build passes**
- [ ] **Step 4: Commit**

---

## Task 5: Restyle Departments Settings Page

**Files:**
- Modify: `src/app/(app)/settings/masterdata/departments/page.tsx`

- [ ] **Step 1: Complete rewrite of the departments settings page**

Same pattern:
- Page header: Layers icon, "Departments", "Manage department and cost center data"
- DataTable columns: Code, Name, Actions
- Create/Edit Modal fields: deptCode (Input required), deptName (Input required)
- Import Modal: FileImport entityType="department"
- Delete confirmation Modal
- useToast() for feedback

- [ ] **Step 2: Verify no hardcoded colors remain**
- [ ] **Step 3: Verify build passes**
- [ ] **Step 4: Commit**

---

## Task 6: Final verification

- [ ] **Step 1: Full build check**
- [ ] **Step 2: Verify no hardcoded colors in any settings/masterdata page**
- [ ] **Step 3: Verify all pages use consistent design pattern**
