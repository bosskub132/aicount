# Phase 4B: Tax Reports & VAT Registers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 Thai tax reports (ภ.พ.30, ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53, Purchase/Sales VAT Registers) with form-matching PDFs, integrated with Phase 4A report history/retention.

**Architecture:** Tax Report Hub at `/reports/tax` links to 6 sub-pages. Queries join documents with vendors/customers for tax data. WHT reports auto-route to PND3/PND53 based on `vendor_type`. PDFs match official Revenue Department forms. Reuses Phase 4A infrastructure (report_history, retention, PdfPreviewModal, PeriodPicker).

**Tech Stack:** Same as Phase 4A + schema additions to vendors/customers/documents tables.

**Spec:** `docs/superpowers/specs/2026-03-25-phase4b-tax-reports-design.md`
**Depends on:** Phase 4A complete

---

## File Structure

### New Files

**Queries:**
- `src/lib/db/queries/tax-pp30.ts`
- `src/lib/db/queries/tax-pp36.ts`
- `src/lib/db/queries/tax-pnd3.ts`
- `src/lib/db/queries/tax-pnd53.ts`
- `src/lib/db/queries/vat-register.ts`

**Services:**
- `src/lib/services/tax-pdf-templates.ts`
- `src/lib/services/wht-form-routing.ts`

**Hooks:**
- `src/lib/hooks/use-tax-pp30.ts`
- `src/lib/hooks/use-tax-pp36.ts`
- `src/lib/hooks/use-tax-pnd3.ts`
- `src/lib/hooks/use-tax-pnd53.ts`
- `src/lib/hooks/use-vat-register.ts`

**Pages:**
- `src/app/(app)/reports/tax/page.tsx`
- `src/app/(app)/reports/tax/pp30/page.tsx`
- `src/app/(app)/reports/tax/pp36/page.tsx`
- `src/app/(app)/reports/tax/pnd3/page.tsx`
- `src/app/(app)/reports/tax/pnd53/page.tsx`
- `src/app/(app)/reports/tax/purchase-vat/page.tsx`
- `src/app/(app)/reports/tax/sales-vat/page.tsx`

**API Routes:**
- `src/app/api/tenants/[id]/reports/tax/pp30/route.ts`
- `src/app/api/tenants/[id]/reports/tax/pp36/route.ts`
- `src/app/api/tenants/[id]/reports/tax/pnd3/route.ts`
- `src/app/api/tenants/[id]/reports/tax/pnd53/route.ts`
- `src/app/api/tenants/[id]/reports/tax/purchase-vat/route.ts`
- `src/app/api/tenants/[id]/reports/tax/sales-vat/route.ts`

### Files to Modify

- `src/lib/db/schema.ts` — Add vendor_type, is_non_resident, branch_number, country to vendors; branch_number to customers; issuer_branch, wht_income_type, wht_rate to documents
- `src/app/api/tenants/[id]/vendors/route.ts` — Accept new fields
- `src/app/api/tenants/[id]/vendors/bulk/route.ts` — Accept new fields
- `src/app/(app)/settings/masterdata/vendors/page.tsx` — Add form fields
- `src/app/api/tenants/[id]/customers/route.ts` — Accept branch_number
- `src/app/(app)/settings/masterdata/customers/page.tsx` — Add branch_number field
- `src/lib/services/wht-pdf.ts` — Enhance detectWht() to persist wht_income_type + wht_rate
- `src/app/api/documents/[id]/route.ts` — Accept issuerBranch
- `src/lib/inngest/functions/process-document.ts` — Map OCR branch to issuer_branch, persist wht fields
- `src/lib/utils/constants.ts` — Add tax report types to REPORT_RETENTION_CATEGORY
- `src/app/api/tenants/[id]/restore/route.ts` — Update vendor/customer restore payload

### Files to Deprecate

- `src/app/api/tenants/[id]/tax-report/pp30/route.ts` → replaced by `/reports/tax/pp30`
- `src/app/api/tenants/[id]/tax-report/pnd353/route.ts` → replaced by `/reports/tax/pnd3` and `/reports/tax/pnd53`
- `src/app/(app)/settings/accounting/tax-reports/page.tsx` → replaced by proper report pages

---

## Task Breakdown

### Task 1: Schema changes — vendors, customers, documents

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/utils/constants.ts`

- [ ] **Step 1: Add fields to vendors table**

```typescript
vendorType: varchar("vendor_type", { length: 20 }).default("company").notNull(),
isNonResident: boolean("is_non_resident").default(false).notNull(),
branchNumber: varchar("branch_number", { length: 20 }),
country: varchar("country", { length: 100 }),
```

- [ ] **Step 2: Add branch_number to customers table**

```typescript
branchNumber: varchar("branch_number", { length: 20 }),
```

- [ ] **Step 3: Add fields to documents table**

```typescript
issuerBranch: varchar("issuer_branch", { length: 20 }),
whtIncomeType: varchar("wht_income_type", { length: 50 }),
whtRate: decimal("wht_rate", { precision: 5, scale: 2 }),
```

- [ ] **Step 4: Update REPORT_RETENTION_CATEGORY**

Add: `pp30: "tax"`, `pp36: "tax"`, `pnd3: "tax"`, `pnd53: "tax"`, `purchase_vat: "tax"`, `sales_vat: "tax"`

- [ ] **Step 5: Generate migration**

Run: `npx drizzle-kit generate`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add vendor_type, is_non_resident, branch_number, wht fields to schema"
```

---

### Task 2: Update vendor/customer CRUD

**Files:**
- Modify: `src/app/api/tenants/[id]/vendors/route.ts`
- Modify: `src/app/api/tenants/[id]/vendors/bulk/route.ts`
- Modify: `src/app/(app)/settings/masterdata/vendors/page.tsx`
- Modify: `src/app/api/tenants/[id]/customers/route.ts`
- Modify: `src/app/(app)/settings/masterdata/customers/page.tsx`

- [ ] **Step 1: Update vendor API routes**

Accept `vendorType`, `isNonResident`, `branchNumber`, `country` in POST/PUT body. Validate `vendorType` is `individual` or `company`. Validate `country` is required when `isNonResident` is true.

- [ ] **Step 2: Update vendor settings UI**

Add: Vendor Type select (Individual/Company), Non-Resident toggle, Branch Number input. Country field appears only when Non-Resident is ON (progressive disclosure).

- [ ] **Step 3: Update customer API and UI**

Accept `branchNumber` in API. Add Branch Number input to customer form.

- [ ] **Step 4: Update restore route**

Expand vendor/customer restore payload to include new fields.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: update vendor/customer CRUD for tax report fields"
```

---

### Task 3: WHT detection enhancements

**Files:**
- Modify: `src/lib/services/wht-pdf.ts`
- Create: `src/lib/services/wht-form-routing.ts`
- Modify: `src/lib/inngest/functions/process-document.ts`
- Modify: `src/app/api/documents/[id]/route.ts`

- [ ] **Step 1: Create wht-form-routing.ts**

```typescript
export function getWhtFormType(vendor: {
  vendorType: "individual" | "company";
  isNonResident: boolean;
}): "pnd3" | "pnd53" | "pp36" {
  if (vendor.isNonResident) return "pp36";
  if (vendor.vendorType === "individual") return "pnd3";
  return "pnd53";
}
```

Plus `WHT_INCOME_TYPES_PND3` and `WHT_INCOME_TYPES_PND53` constants from spec.

- [ ] **Step 2: Enhance detectWht() to return income type**

Update `detectWht()` in `wht-pdf.ts` to return `{ applicable, rate, amount, reason, incomeType }` where `incomeType` is the matched keyword (e.g. "ค่าบริการ").

- [ ] **Step 3: Update process-document.ts**

After OCR extraction:
- Map `ocrRaw.issuer.branch_id` → `documents.issuerBranch`
- Persist `whtIncomeType` and `whtRate` from detectWht() result on the document record

- [ ] **Step 4: Update document PATCH route**

Accept `issuerBranch` as optional field in PATCH body.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: enhance WHT detection with income type, form routing, and branch mapping"
```

---

### Task 4: Tax report queries

**Files:**
- Create: `src/lib/db/queries/tax-pp30.ts`
- Create: `src/lib/db/queries/tax-pp36.ts`
- Create: `src/lib/db/queries/tax-pnd3.ts`
- Create: `src/lib/db/queries/tax-pnd53.ts`
- Create: `src/lib/db/queries/vat-register.ts`

- [ ] **Step 1: Create tax-pp30.ts**

Output VAT sum + Input VAT sum → net payable. Query from documents by direction + status + period.

- [ ] **Step 2: Create tax-pp36.ts**

Join documents with vendors where `is_non_resident = true`. Return line items with vendor details.

- [ ] **Step 3: Create tax-pnd3.ts and tax-pnd53.ts**

Two-pass query (matched + unmatched) as defined in spec. PND3 filters `vendor_type = 'individual'`, PND53 filters `vendor_type = 'company'`. Unmatched documents default to PND53.

- [ ] **Step 4: Create vat-register.ts**

Shared query with `direction` param. Purchase register joins vendors, Sales register joins customers. Returns line-by-line data with branch resolution (document → vendor/customer → '00000').

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add tax report query modules (PP30, PP36, PND3, PND53, VAT registers)"
```

---

### Task 5: Tax report API routes

**Files:**
- Create: 6 API route files under `src/app/api/tenants/[id]/reports/tax/`

- [ ] **Step 1: Create all 6 API routes**

Each follows standard auth pattern. Accept `period` (YYYY-MM) query param. Call corresponding query module. Return JSON response.

- [ ] **Step 2: Deprecate old routes**

Add deprecation comments to old `tax-report/pp30` and `tax-report/pnd353` routes pointing to new locations.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add 6 tax report API routes"
```

---

### Task 6: React Query hooks

**Files:**
- Create: 5 hook files

- [ ] **Step 1: Create hooks**

`use-tax-pp30.ts`, `use-tax-pp36.ts`, `use-tax-pnd3.ts`, `use-tax-pnd53.ts`, `use-vat-register.ts` (shared with direction param).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add React Query hooks for tax reports"
```

---

### Task 7: Tax PDF templates

**Files:**
- Create: `src/lib/services/tax-pdf-templates.ts`

- [ ] **Step 1: Create form-matching templates**

6 templates: PP30, PP36, PND3, PND53, PurchaseVatRegisterPdf, SalesVatRegisterPdf.

Tax filing PDFs replicate official RD form layout (boxes, checkboxes, signature area). VAT register PDFs use standard tabular layout with Thai headers.

- [ ] **Step 2: Register with report-generator.ts**

Add tax report types to the report generator's template dispatcher.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add tax report PDF templates matching Revenue Department forms"
```

---

### Task 8: Tax Reports Hub + 6 report pages

**Files:**
- Create: `src/app/(app)/reports/tax/page.tsx` + 6 sub-pages

- [ ] **Step 1: Create Tax Reports Hub**

Same pattern as Phase 4A hub. 2 sections: Tax Filing (4 cards) + VAT Registers (2 cards).

- [ ] **Step 2: Create ภ.พ.30 page**

Summary view: Output VAT, Input VAT, Net Payable. Period picker (monthly only). Generate PDF button.

- [ ] **Step 3: Create ภ.พ.36 page**

Line items from non-resident vendors. Period picker + Generate PDF.

- [ ] **Step 4: Create ภ.ง.ด.3 page**

Individual vendor WHT items. Unmatched section with warnings. Period picker + Generate PDF.

- [ ] **Step 5: Create ภ.ง.ด.53 page**

Same as PND3 but for company vendors. Unmatched documents default here.

- [ ] **Step 6: Create Purchase VAT Register page**

Line-by-line table with Thai column headers. Paginated (50 rows). Period picker + Generate PDF.

- [ ] **Step 7: Create Sales VAT Register page**

Same as purchase but for sales (REVENUE direction, customer data).

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: add Tax Reports hub and 6 tax report pages"
```

---

### Task 9: Integration testing & polish

- [ ] **Step 1: Test all 6 tax report pages load**
- [ ] **Step 2: Test vendor_type routing — PND3 shows individuals, PND53 shows companies**
- [ ] **Step 3: Test PP36 shows only non-resident vendors**
- [ ] **Step 4: Test VAT registers show correct direction data**
- [ ] **Step 5: Test PDF generation for each tax report type**
- [ ] **Step 6: Test vendor/customer settings with new fields**
- [ ] **Step 7: Verify build passes**

Run: `npx next build`

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: Phase 4B Tax Reports complete — 6 reports, form-matching PDFs, vendor type routing"
```
