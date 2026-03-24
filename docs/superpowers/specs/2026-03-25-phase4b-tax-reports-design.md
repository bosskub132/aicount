# Phase 4B: Tax Reports & VAT Registers — Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Branch:** feature/app-v2
**Depends on:** Phase 4A (Financial Statements) complete

---

## 1. Overview

Phase 4B adds 6 Thai tax reports to AICount under `/reports/tax`, with interactive screen views, form-matching PDF generation, and integration with the report history/retention system from Phase 4A.

### Reports Included

| # | Report | Thai Name | Category | Frequency |
|---|--------|-----------|----------|-----------|
| 1 | ภ.พ.30 | แบบแสดงรายการภาษีมูลค่าเพิ่ม | Tax Filing | Monthly |
| 2 | ภ.พ.36 | แบบนำส่งภาษีมูลค่าเพิ่ม (บริการจากต่างประเทศ) | Tax Filing | Monthly |
| 3 | ภ.ง.ด.3 | แบบยื่นรายการภาษีเงินได้หัก ณ ที่จ่าย (บุคคลธรรมดา) | Tax Filing | Monthly |
| 4 | ภ.ง.ด.53 | แบบยื่นรายการภาษีเงินได้หัก ณ ที่จ่าย (นิติบุคคล) | Tax Filing | Monthly |
| 5 | รายงานภาษีซื้อ | Purchase VAT Register (Input Tax) | VAT Register | Monthly |
| 6 | รายงานภาษีขาย | Sales VAT Register (Output Tax) | VAT Register | Monthly |

### Scope Exclusions (Future)

- **ภ.ง.ด.1 / ภ.ง.ด.1ก** — Employee WHT (monthly/annual). Requires payroll module which does not exist. Deferred as future improvement when payroll is added.
- **ภ.ง.ด.54** — WHT for payments to foreign entities. Can be added as extension of ภ.พ.36 flow later.
- **E-filing integration** — Direct submission to rd.go.th. Future phase.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page layout | Report Hub (same as 4A) — card grid → sub-pages | Consistent UX |
| Report mode | Interactive screen + form-matching PDF (same as 4A) | Quick review + official records |
| PDF generation | Server-side @react-pdf/renderer | Same as 4A, unified stack |
| Report history | Reuses Phase 4A report_history table and retention system | No duplication |
| ภ.ง.ด.3 vs 53 routing | Automatic via `vendors.vendor_type` field | Clean separation, no manual selection |
| ภ.พ.36 filtering | Via `vendors.is_non_resident` field | Automatic identification |
| Branch number | Master data default + per-document override | Handles multi-branch vendors |
| UI alignment | Same patterns as Phase 4A (stat cards, period picker, filters, history drawer) | Consistent experience |

---

## 1.1 Critical Implementation Notes

### Schema Changes Required (Cross-Phase Impact)

Phase 4B requires adding fields to existing tables. These affect Phase 2/3 code and must be implemented carefully with backward compatibility.

**`vendors` table — 3 new fields:**
- `vendor_type` VARCHAR(20) NOT NULL DEFAULT 'company' — values: `individual`, `company`
- `is_non_resident` BOOLEAN NOT NULL DEFAULT false
- `branch_number` VARCHAR(20) NULL — e.g. "00000" (head office) or "00001"

**`customers` table — 1 new field:**
- `branch_number` VARCHAR(20) NULL

**`vendors` table — 1 additional field:**
- `country` VARCHAR(100) NULL — required for non-resident vendors (ภ.พ.36 form requires service provider's country)

**`documents` table — 3 new fields:**
- `issuer_branch` VARCHAR(20) NULL — per-document override, OCR-extractable
- `wht_income_type` VARCHAR(50) NULL — WHT income category (e.g. 'ค่าบริการ', 'ค่าเช่า'), populated during WHT detection in `process-document.ts`
- `wht_rate` DECIMAL(5,2) NULL — WHT rate applied (e.g. 0.03 = 3%), populated during WHT detection. Replaces fragile `ocrRaw.wht.rate` JSON extraction

### OCR Pipeline Integration Check

The existing OCR service (`src/lib/services/ocr.ts` line 570) **already extracts branch data** from tax invoices. It detects "สำนักงานใหญ่" (head office) vs branch numbers and maps to `issuer.branch_id` in the OCR response.

**Required changes:**
1. Map `ocrRaw.issuer.branch_id` to `documents.issuer_branch` column during document processing
2. Verify extraction UI (`/extractions` page) already has `issuerBranch` editing — **confirmed at lines 283-288, 521-527** (no changes needed)
3. Add confidence scoring for `issuer_branch` field
4. Default logic: if `issuer_branch` is NULL, fall back to matched vendor's `branch_number`

### WHT Form Routing Logic

```typescript
function getWhtFormType(vendor: { vendorType: string; isNonResident: boolean }): string {
  if (vendor.isNonResident) return 'pp36';      // ภ.พ.36
  if (vendor.vendorType === 'individual') return 'pnd3';   // ภ.ง.ด.3
  return 'pnd53';                                // ภ.ง.ด.53
}
```

Defined in `src/lib/utils/constants.ts`.

### Backward Compatibility

All new fields have sensible defaults:
- `vendor_type` defaults to `'company'` — most vendors in B2B accounting are companies
- `is_non_resident` defaults to `false` — domestic vendors are the majority
- `branch_number` defaults to NULL — optional field
- `issuer_branch` defaults to NULL — OCR fills when detected

Existing vendors/customers/documents continue to work without any migration of existing data.

---

## 2. UI Design

### 2.1 Tax Reports Hub (`/reports/tax`)

Same Report Hub pattern as Phase 4A, with 4-column grid and two sections.

**Layout:**
- Page header: "Tax Reports" / "รายงานภาษี" + period selector
- Section 1: "Tax Filing · แบบยื่นภาษี" — 4 cards (ภ.พ.30, ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53)
- Section 2: "VAT Registers · รายงานภาษีมูลค่าเพิ่ม" — 2 cards + 2 empty slots

**Card icons (lucide-react):**
- ภ.พ.30: `Receipt` (blue #2563eb on #eff6ff)
- ภ.พ.36: `Globe` (purple #7c3aed on #f5f3ff)
- ภ.ง.ด.3: `User` (green #059669 on #f0fdf4)
- ภ.ง.ด.53: `Building2` (amber #d97706 on #fef3c7)
- Purchase VAT Register: `ShoppingCart` (rose #e11d48 on #fce4ec)
- Sales VAT Register: `Store` (orange #ea580c on #fff7ed)

### 2.2 Individual Report Pages

All follow the same Phase 4A pattern: header → stat cards → filters → data table.

**Period picker:** Monthly only (tax reports are always monthly filings). No Quarterly/Yearly toggle. Uses same `<PeriodPicker>` component with scope locked to `monthly`.

**Filter bar per report:**

| Report | Period | Custom Range | Department | Vendor Type | Non-Resident |
|--------|:---:|:---:|:---:|:---:|:---:|
| ภ.พ.30 | Y | — | — | — | — |
| ภ.พ.36 | Y | — | — | — | Auto (non-resident only) |
| ภ.ง.ด.3 | Y | — | — | Auto (individual only) | — |
| ภ.ง.ด.53 | Y | — | — | Auto (company only) | — |
| Purchase VAT Register | Y | — | — | — | — |
| Sales VAT Register | Y | — | — | — | — |

Note: ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53 auto-filter by vendor type/resident status — no manual filter needed.

### 2.3 Stat Cards Per Report

| Report | Card 1 | Card 2 | Card 3 | Card 4 |
|--------|--------|--------|--------|--------|
| ภ.พ.30 | Output VAT (ภาษีขาย) | Input VAT (ภาษีซื้อ) | Net VAT Payable | Filing Status |
| ภ.พ.36 | Total Services Amount | VAT Payable | # of Transactions | # of Vendors |
| ภ.ง.ด.3 | Total WHT Amount | # of Payees | # of Payments | Most Common Rate |
| ภ.ง.ด.53 | Total WHT Amount | # of Payees | # of Payments | Most Common Rate |
| Purchase VAT Register | Total Purchases (excl VAT) | Total Input VAT | # of Invoices | # of Vendors |
| Sales VAT Register | Total Sales (excl VAT) | Total Output VAT | # of Invoices | # of Customers |

### 2.4 Data Table Columns Per Report

**ภ.พ.30 (VAT Return Summary):**

| Column | Description |
|--------|-------------|
| Item | Line item description (per official form) |
| Tax Base (ฐานภาษี) | Amount before VAT |
| VAT Amount (จำนวนเงินภาษี) | 7% VAT |

Rows follow the official ภ.พ.30 form structure:
1. Sales/Output VAT
2. Purchases/Input VAT
3. Net VAT (1 - 2)
4. Excess VAT credit from prior period (if any)
5. VAT payable / refundable

**ภ.พ.36 (Non-Resident Services VAT):**

| Column | Description |
|--------|-------------|
| # | Running number |
| Vendor Name | Non-resident vendor name |
| Country | vendors.country (required for non-resident vendors) |
| Service Description | From document description |
| Amount | Service amount |
| VAT (7%) | Calculated VAT |

**ภ.ง.ด.3 / ภ.ง.ด.53 (WHT Filing — same structure):**

| Column | Description |
|--------|-------------|
| # | Running number |
| Payee Name | Vendor name |
| Tax ID | Vendor tax ID |
| Branch | Vendor branch number |
| Payment Date | Document/payment date |
| Income Type | WHT income category (ค่าเช่า, ค่าบริการ, etc.) |
| Amount Paid | Payment amount |
| WHT Rate | Applicable rate |
| WHT Amount | Withheld amount |

Footer: Total WHT amount, count of payees.

**Purchase VAT Register (รายงานภาษีซื้อ):**

| Column | Thai Header | Source |
|--------|-------------|-------|
| ลำดับที่ | Running # | Auto-generated |
| วันเดือนปี | Tax invoice date | documents.documentDate |
| เลขที่ใบกำกับภาษี | Tax invoice number | documents.documentNumber |
| ชื่อผู้ขาย | Vendor name | documents.issuerName / vendors.name |
| เลขประจำตัวผู้เสียภาษี | Tax ID | documents.issuerTaxId / vendors.taxId |
| สำนักงานใหญ่/สาขา | Branch | documents.issuerBranch / vendors.branchNumber |
| มูลค่าสินค้า/บริการ | Amount before VAT | documents.subtotal |
| จำนวนเงินภาษี | VAT amount | documents.vatAmount |

Filter: `documents.direction = 'EXPENSE'` AND `documents.status = 'APPROVED'` AND `documents.vatAmount > 0`

**Sales VAT Register (รายงานภาษีขาย):**

Same columns as Purchase but:
- "ชื่อผู้ซื้อ" (Customer name) instead of vendor
- Filter: `documents.direction = 'REVENUE'` AND `documents.status = 'APPROVED'` AND `documents.vatAmount > 0`
- Customer branch from `customers.branchNumber`

### 2.5 PDF Templates

**Tax Filing PDFs (ภ.พ.30, ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53):**
- Form-matching layout that visually replicates the official Revenue Department forms
- Company header with tax ID, branch, address
- Form number and filing period prominently displayed
- Data populated from the same query as the screen view
- Signature/stamp area at bottom (blank for printing)
- Attachment schedules (ใบแนบ) for ภ.ง.ด.3/53 with itemized payee list

**VAT Register PDFs:**
- Standard tabular layout (same as Phase 4A accounting reports)
- Thai column headers matching Revenue Department requirements
- Running totals per page and grand total
- Company header, period, page numbers

### 2.6 Vendor/Customer Master Data Updates

**Vendor settings page** (`/settings/masterdata/vendors`) — add fields:

| Field | Type | Label (EN) | Label (TH) | Notes |
|-------|------|-----------|-------------|-------|
| vendor_type | Select | Vendor Type | ประเภทผู้ขาย | Options: Individual (บุคคลธรรมดา), Company (นิติบุคคล) |
| is_non_resident | Toggle | Non-Resident | ผู้ขายต่างประเทศ | Default off |
| branch_number | Input | Branch Number | สาขา | Placeholder: "00000 = Head Office" |

**Customer settings page** (`/settings/masterdata/customers`) — add field:

| Field | Type | Label (EN) | Label (TH) | Notes |
|-------|------|-----------|-------------|-------|
| branch_number | Input | Branch Number | สาขา | Placeholder: "00000 = Head Office" |

---

## 3. Technical Architecture

### 3.1 Route Structure

```
src/app/(app)/reports/tax/
  page.tsx                     # Tax Reports Hub (Server Component)
  pp30/page.tsx                # ภ.พ.30 VAT Return
  pp36/page.tsx                # ภ.พ.36 Non-Resident Services
  pnd3/page.tsx                # ภ.ง.ด.3 Individual WHT
  pnd53/page.tsx               # ภ.ง.ด.53 Corporate WHT
  purchase-vat/page.tsx        # Purchase VAT Register
  sales-vat/page.tsx           # Sales VAT Register
```

### 3.2 API Routes

**Report data (GET):**
```
GET /api/tenants/{id}/reports/tax/pp30           # Enhanced from existing pp30 route
GET /api/tenants/{id}/reports/tax/pp36           # NEW
GET /api/tenants/{id}/reports/tax/pnd3           # NEW (replaces pnd353, filtered to individuals)
GET /api/tenants/{id}/reports/tax/pnd53          # NEW (replaces pnd353, filtered to companies)
GET /api/tenants/{id}/reports/tax/purchase-vat   # NEW
GET /api/tenants/{id}/reports/tax/sales-vat      # NEW
```

**PDF generation:** Reuses Phase 4A endpoint:
```
POST /api/tenants/{id}/reports/generate-pdf      # Same endpoint, report_type differentiates
```

**Existing routes to deprecate:**
- `GET /api/tenants/{id}/tax-report/pp30` → move to `/api/tenants/{id}/reports/tax/pp30`
- `GET /api/tenants/{id}/tax-report/pnd353` → split into `/reports/tax/pnd3` and `/reports/tax/pnd53`

**Vendor/Customer API updates:**
```
PUT /api/tenants/{id}/vendors/{vendorId}         # Accept vendor_type, is_non_resident, branch_number
PUT /api/tenants/{id}/customers/{customerId}     # Accept branch_number
```

All routes follow the existing auth pattern.

### 3.3 Database Schema Changes

**`vendors` table additions:**

| Column | Type | Default | Constraint |
|--------|------|---------|-----------|
| vendor_type | VARCHAR(20) | 'company' | NOT NULL, CHECK IN ('individual', 'company') |
| is_non_resident | BOOLEAN | false | NOT NULL |
| branch_number | VARCHAR(20) | NULL | |
| country | VARCHAR(100) | NULL | Required for non-resident vendors (ภ.พ.36) |

**`customers` table additions:**

| Column | Type | Default |
|--------|------|---------|
| branch_number | VARCHAR(20) | NULL |

**`documents` table additions:**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| issuer_branch | VARCHAR(20) | NULL | OCR-extractable, editable in extractions UI |
| wht_income_type | VARCHAR(50) | NULL | WHT income category, populated by detectWht() |
| wht_rate | DECIMAL(5,2) | NULL | WHT rate (e.g. 0.03 = 3%), populated by detectWht() |

**Report type additions for report_history:**

Add to the `report_type` check constraint: `pp30`, `pp36`, `pnd3`, `pnd53`, `purchase_vat`, `sales_vat`

**Retention category mapping update** (in `src/lib/utils/constants.ts`):

```typescript
const REPORT_RETENTION_CATEGORY: Record<string, string> = {
  // Phase 4A
  trial_balance: 'financial',
  profit_loss: 'financial',
  balance_sheet: 'financial',
  cash_flow: 'financial',
  monthly_comparison: 'management',
  gl_detail: 'management',
  journal_listing: 'management',
  // Phase 4B
  pp30: 'tax',
  pp36: 'tax',
  pnd3: 'tax',
  pnd53: 'tax',
  purchase_vat: 'tax',
  sales_vat: 'tax',
};
```

### 3.4 Database Queries

```
src/lib/db/queries/
  tax-pp30.ts          # Output VAT - Input VAT = Net payable
  tax-pp36.ts          # Non-resident vendor documents with VAT
  tax-pnd3.ts          # WHT payments to individual vendors
  tax-pnd53.ts         # WHT payments to company vendors
  vat-register.ts      # Purchase + Sales VAT register (shared, direction param)
```

**Query patterns:**

**ภ.พ.30:**
```sql
-- Output VAT (sales)
SELECT COALESCE(SUM(vat_amount), 0) FROM documents
WHERE tenant_id = $1 AND direction = 'REVENUE' AND status = 'APPROVED'
AND document_date BETWEEN $2 AND $3

-- Input VAT (purchases)
SELECT COALESCE(SUM(vat_amount), 0) FROM documents
WHERE tenant_id = $1 AND direction = 'EXPENSE' AND status = 'APPROVED'
AND document_date BETWEEN $2 AND $3
```

**ภ.ง.ด.3 / ภ.ง.ด.53 (two-pass query for matched + unmatched):**
```sql
-- Pass 1: Matched documents (filtered by vendor_type)
SELECT d.document_date, d.document_number, d.issuer_name, d.issuer_tax_id,
  d.wht_income_type, d.wht_rate, d.wht_amount, d.subtotal,
  COALESCE(d.issuer_branch, v.branch_number, '00000') as branch,
  v.name as vendor_name, v.tax_id as vendor_tax_id, v.address as vendor_address,
  'matched' as match_status
FROM documents d
INNER JOIN vendors v ON v.tenant_id = d.tenant_id AND v.tax_id = d.issuer_tax_id
WHERE d.tenant_id = $1 AND d.status = 'APPROVED'
AND d.wht_amount > 0 AND d.document_date BETWEEN $2 AND $3
AND v.vendor_type = $4 AND v.is_non_resident = false

UNION ALL

-- Pass 2: Unmatched documents (WHT exists but no vendor match)
SELECT d.document_date, d.document_number, d.issuer_name, d.issuer_tax_id,
  d.wht_income_type, d.wht_rate, d.wht_amount, d.subtotal,
  COALESCE(d.issuer_branch, '00000') as branch,
  d.issuer_name as vendor_name, d.issuer_tax_id as vendor_tax_id, NULL as vendor_address,
  'unmatched' as match_status
FROM documents d
LEFT JOIN vendors v ON v.tenant_id = d.tenant_id AND v.tax_id = d.issuer_tax_id
WHERE d.tenant_id = $1 AND d.status = 'APPROVED'
AND d.wht_amount > 0 AND d.document_date BETWEEN $2 AND $3
AND v.id IS NULL

ORDER BY match_status, document_date
```

**Purchase VAT Register (รายงานภาษีซื้อ):**
```sql
SELECT d.document_date, d.document_number, d.issuer_name, d.issuer_tax_id,
  COALESCE(d.issuer_branch, v.branch_number, '00000') as branch,
  d.subtotal, d.vat_amount
FROM documents d
LEFT JOIN vendors v ON v.tenant_id = d.tenant_id AND v.tax_id = d.issuer_tax_id
WHERE d.tenant_id = $1 AND d.direction = 'EXPENSE'
AND d.status = 'APPROVED' AND d.vat_amount > 0
AND d.document_date BETWEEN $2 AND $3
ORDER BY d.document_date, d.document_number
```

**Sales VAT Register (รายงานภาษีขาย):**
```sql
-- Note: Sales side joins CUSTOMERS (not vendors). The issuer is our company;
-- the buyer's info comes from the document or customer master data.
SELECT d.document_date, d.document_number,
  COALESCE(c.name, d.issuer_name) as buyer_name,
  COALESCE(c.tax_id, d.issuer_tax_id) as buyer_tax_id,
  COALESCE(c.branch_number, '00000') as branch,
  d.subtotal, d.vat_amount
FROM documents d
LEFT JOIN customers c ON c.tenant_id = d.tenant_id AND c.tax_id = d.issuer_tax_id
WHERE d.tenant_id = $1 AND d.direction = 'REVENUE'
AND d.status = 'APPROVED' AND d.vat_amount > 0
AND d.document_date BETWEEN $2 AND $3
ORDER BY d.document_date, d.document_number
```

### 3.5 React Query Hooks

```
src/lib/hooks/
  use-tax-pp30.ts          # NEW
  use-tax-pp36.ts          # NEW
  use-tax-pnd3.ts          # NEW
  use-tax-pnd53.ts         # NEW
  use-vat-register.ts      # NEW (shared for purchase + sales, direction param)
```

### 3.6 Services

```
src/lib/services/
  tax-pdf-templates.ts     # @react-pdf/renderer templates for 6 tax report types
  wht-form-routing.ts      # getWhtFormType() logic + income type classification
```

**`wht-form-routing.ts`:**
```typescript
export function getWhtFormType(vendor: {
  vendorType: 'individual' | 'company';
  isNonResident: boolean;
}): 'pnd3' | 'pnd53' | 'pp36' {
  if (vendor.isNonResident) return 'pp36';
  if (vendor.vendorType === 'individual') return 'pnd3';
  return 'pnd53';
}

// WHT income type codes — Revenue Department classification
// PND3 uses Income Tax Act Section 40 paragraphs
// PND53 uses Section 3 tret / Section 70 categories
// NOTE: exact form checkbox mapping to be finalized during implementation
// by cross-referencing with current Revenue Department PND3/PND53 form versions
export const WHT_INCOME_TYPES_PND3 = {
  'เงินเดือน/ค่าจ้าง': { section: '40(1)', rate: null },        // progressive rate
  'ค่านายหน้า': { section: '40(2)', rate: 0.03 },
  'ค่าลิขสิทธิ์': { section: '40(3)', rate: 0.03 },
  'ดอกเบี้ย': { section: '40(4)(a)', rate: 0.01 },
  'เงินปันผล': { section: '40(4)(b)', rate: 0.10 },
  'ค่าเช่าทรัพย์สิน': { section: '40(5)', rate: 0.05 },
  'วิชาชีพอิสระ': { section: '40(6)', rate: 0.03 },
  'ค่าจ้างทำของ': { section: '40(7)', rate: 0.03 },
  'ค่าจ้างรับเหมา': { section: '40(7)', rate: 0.03 },
  'รางวัล/ชิงโชค': { section: '40(8)', rate: 0.05 },
} as const;

export const WHT_INCOME_TYPES_PND53 = {
  'ค่าเช่า': { type: '1', rate: 0.05 },
  'ค่าบริการ/จ้างทำของ': { type: '2', rate: 0.03 },
  'ค่าขนส่ง': { type: '3', rate: 0.01 },
  'ค่าโฆษณา': { type: '4', rate: 0.02 },
  'ดอกเบี้ย': { type: '5', rate: 0.01 },
  'เงินปันผล': { type: '6', rate: 0.10 },
  'ค่าที่ปรึกษา': { type: '7', rate: 0.03 },
  'ค่านายหน้า': { type: '8', rate: 0.03 },
} as const;
```

### 3.7 New Components

No new shared components needed — reuses Phase 4A components:
- `<PeriodPicker>` (scope locked to monthly)
- `<ReportFilterBar>`
- `<ReportStatCards>`
- `<PdfPreviewModal>`
- `<ReportHistoryDrawer>`

### 3.8 PDF Templates

**Form-matching templates (ภ.พ.30, ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53):**
- Replicate official Revenue Department form layouts
- Boxes, field labels, and structure matching the printed forms
- Company tax ID in header, filing period, branch
- Data populated from queries
- Blank signature area at bottom
- ภ.ง.ด.3/53 include attachment schedule (ใบแนบ) with itemized payee list

**VAT Register templates:**
- Standard tabular layout with Thai headers
- Running totals per page
- Grand total on last page
- Matches Revenue Department required format

---

## 4. Cross-Phase File Impact

### 4.1 Files Requiring Changes (Existing Code)

| File | Change | Complexity |
|------|--------|-----------|
| `src/lib/db/schema.ts` | Add 8 new columns across 3 tables (vendor_type, is_non_resident, branch_number, country on vendors; branch_number on customers; issuer_branch, wht_income_type, wht_rate on documents) | HIGH |
| `src/app/api/tenants/[id]/vendors/route.ts` | Accept vendor_type, is_non_resident, branch_number in POST/PUT | MEDIUM |
| `src/app/api/tenants/[id]/vendors/bulk/route.ts` | Accept 3 new fields in bulk upsert | MEDIUM |
| `src/app/(app)/settings/masterdata/vendors/page.tsx` | Add vendor_type select, is_non_resident toggle, branch_number input | MEDIUM |
| `src/app/api/tenants/[id]/customers/route.ts` | Accept branch_number in POST/PUT | LOW |
| `src/app/(app)/settings/masterdata/customers/page.tsx` | Add branch_number input | LOW |
| `src/lib/services/wht-pdf.ts` | Add vendorType/isNonResident params to detectWht(); persist wht_income_type + wht_rate on document; enhance generate50TawiFile() | HIGH |
| `src/app/api/documents/[id]/route.ts` | Accept issuerBranch in PATCH | LOW |
| `src/app/api/documents/[id]/submit/route.ts` | Pass vendor info to detectWht() | LOW |
| `src/app/api/tenants/[id]/wht-certificates/batch/route.ts` | Fetch vendor record, pass type/branch to certificate generator | MEDIUM |
| `src/app/api/tenants/[id]/restore/route.ts` | Update vendor/customer restore payload for new fields | MEDIUM |
| `src/lib/inngest/functions/process-document.ts` | Map ocrRaw.issuer.branch_id to documents.issuer_branch | LOW |

### 4.2 Files Requiring NO Changes

These files auto-include new columns via Drizzle select or are unaffected:
- `src/lib/db/queries/master-data.ts` — select() includes new fields automatically
- `src/lib/db/queries/payables.ts` — no code changes needed
- `src/lib/db/queries/receivables.ts` — no code changes needed
- `src/app/api/tenants/[id]/export-all/route.ts` — exports automatically include new fields
- `src/app/(app)/extractions/page.tsx` — already handles issuerBranch editing (lines 283-288, 521-527)
- `src/app/api/search/route.ts` — returns only id/label, unaffected

### 4.3 Routes to Deprecate

| Old Route | New Route | Action |
|-----------|-----------|--------|
| `GET /api/tenants/{id}/tax-report/pp30` | `GET /api/tenants/{id}/reports/tax/pp30` | Redirect old → new for backward compat, remove after 1 release |
| `GET /api/tenants/{id}/tax-report/pnd353` | Split into `/reports/tax/pnd3` and `/reports/tax/pnd53` | Remove old route |
| `src/app/(app)/settings/accounting/tax-reports/page.tsx` | Replaced by proper report pages | Remove stub page |

---

## 5. Data Flow

### 5.1 VAT Register Flow

```
User selects month → GET /reports/tax/purchase-vat?period=2026-03 →
Query documents WHERE direction='EXPENSE' AND vatAmount > 0 AND status='APPROVED' →
JOIN vendors for branch_number fallback →
Return line-by-line register data →
Page renders table with Thai column headers
```

### 5.2 WHT Filing Flow

```
User opens ภ.ง.ด.53 → GET /reports/tax/pnd53?period=2026-03 →
Query documents WHERE whtAmount > 0 AND status='APPROVED' →
JOIN vendors WHERE vendor_type='company' AND is_non_resident=false →
Group by vendor, sum WHT amounts by rate →
Return: payee list + summary totals →
Page renders: summary stat cards + itemized payee table
```

### 5.3 PDF Generation (Form-Matching)

```
User clicks "Generate PDF" → POST /reports/generate-pdf { reportType: 'pnd53', period: '2026-03' } →
Server queries same data as screen view →
Renders form-matching PDF template (replicates official RD form layout) →
Includes attachment schedule (ใบแนบ) with all payees →
Uploads to Supabase Storage → Saves to report_history →
Returns PDF URL → Modal opens with preview
```

---

## 6. Sidebar Navigation

No changes needed — existing sidebar already has:
```typescript
{ href: "/reports/tax", label: "Tax Reports", icon: ClipboardList }
```

---

## 7. Additional Specifications

### 7.1 Branch Number Display Logic

Priority order for resolving branch number in reports:
1. `documents.issuer_branch` (per-document OCR/manual entry) — highest priority
2. `vendors.branch_number` (master data default) — fallback
3. `'00000'` (head office) — final fallback if both are NULL

### 7.2 Vendor Type Validation

- When generating ภ.ง.ด.3/53, if a document has WHT but no matched vendor (issuerTaxId doesn't match any vendor), show warning: "Unmatched vendor — cannot determine form type. Please add vendor to master data."
- Reports should show these unmatched documents in a separate "Unmatched" section at the bottom
- Count of unmatched documents shown in stat cards as a warning indicator
- **Routing rule:** Unmatched documents appear ONLY on ภ.ง.ด.53 (company form) as the conservative default, NOT duplicated on both PND3 and PND53. Reason: most B2B WHT payments are to companies. The warning prompts the user to add the vendor to master data with the correct type.

### 7.3 ภ.พ.30 Carry-Forward

The official ภ.พ.30 form includes "excess VAT credit from prior period" (ภาษีที่ชำระเกินยกมา). This requires:
- Storing the net VAT result per month (payable or credit)
- Auto-carrying excess credit to the next month
- Option for accountant to manually adjust the carry-forward amount
- Store in a new field on `report_history` or a simple `vat_carry_forward` table

For Phase 4B MVP: Allow manual entry of prior period excess. Auto-calculation can be added later once monthly closing workflow is established.

### 7.4 Credit Notes in ภ.พ.30

Credit notes (ใบลดหนี้) reduce output or input VAT. The current system stores credit notes as documents with **negative `vat_amount`** values. This means the SUM query in PP30 automatically accounts for credit notes (negative values reduce the total). No special logic needed.

If the system later introduces a separate `doc_type` field for credit notes with positive amounts, the PP30 query must be updated to subtract them.

### 7.5 Pagination for Tax Reports

- **ภ.ง.ด.3/53 and VAT Registers:** Paginated (50 rows per page) with `<Pagination>` component
- **ภ.พ.30 and ภ.พ.36:** Not paginated (summary-level, limited rows)
- **PDF generation:** Always includes all data regardless of pagination

### 7.6 Address in PND3/PND53 PDF Attachment

The attachment schedule (ใบแนบ) for PND3/PND53 PDFs MUST include vendor address. This data comes from `vendors.address` field (already exists in schema). If vendor is unmatched, address shows "—" with a note to add vendor to master data.

### 7.7 ภ.พ.36 Country Field

The PP36 form requires the non-resident service provider's country. The `vendors.country` field is added in this phase. For the vendor settings page:
- `country` field appears only when `is_non_resident` is toggled ON (progressive disclosure)
- Required field when `is_non_resident = true`, validated on save
- For existing non-resident vendors without country: show warning banner on PP36 report page

### 7.8 Phase 4A Retention Settings Update

When Phase 4B lands, update the retention settings UI text in Phase 4A to include ภ.พ.36 in the "Tax Reports" category: "ภ.พ.30, ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53, VAT Registers"

### 7.9 Role-Based Access

Same as Phase 4A (section 7.5 of Phase 4A spec). Tax reports follow identical permission model.

### 7.10 Loading & Empty States

Same patterns as Phase 4A:
- Skeleton stat cards + table during loading
- EmptyState: "No approved documents with VAT found for March 2026" or "No WHT payments found for March 2026"

### 7.11 Period Validation

Tax reports are always monthly. Period format: `YYYY-MM`. The `<PeriodPicker>` component has scope locked to `monthly` with no quarterly/yearly toggle.

---

## 8. Error Handling

- **No vendor match:** Documents with WHT but no matching vendor show in "Unmatched" section with warning
- **Missing vendor_type:** Legacy vendors without vendor_type default to 'company' — show info banner suggesting review
- **No VAT data:** Show EmptyState with guidance to approve documents first
- **PDF generation failure:** Same handling as Phase 4A (toast + retry)
- **Concurrent access:** Same locking behavior as Phase 4A

---

## 9. Testing Considerations

### Thai Accounting Compliance Checks

Before marking Phase 4B complete, verify:

- [ ] ภ.พ.30: Output VAT - Input VAT calculation matches manual spreadsheet
- [ ] ภ.พ.36: Only non-resident vendor transactions appear
- [ ] ภ.ง.ด.3: Only individual vendor WHT appears, company vendors excluded
- [ ] ภ.ง.ด.53: Only company vendor WHT appears, individual vendors excluded
- [ ] VAT Register columns match Revenue Department required format exactly
- [ ] Branch number resolution follows priority order (document → vendor → default)
- [ ] WHT income type codes match Revenue Department classification
- [ ] PDF form layout matches official RD forms (compare side-by-side with printed originals)
- [ ] All amounts use 2 decimal places, Thai Baht formatting
- [ ] Tax IDs display correctly (13 digits with proper formatting)
- [ ] OCR branch extraction maps correctly to issuer_branch field
- [ ] Existing vendors/customers/documents work without migration (backward compat)
