# Phase 4C: WHT Certificates (50 ทวิ) — Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Branch:** feature/app-v2
**Depends on:** Phase 4B (Tax Reports) complete — requires vendor_type, wht_income_type, wht_rate, branch_number fields

---

## 1. Overview

Phase 4C upgrades the WHT certificate system from a plain text file generator to a proper PDF certificate matching the official Revenue Department 50 ทวิ form, with bulk generation, a certificate register/log, and integration with the report history system from Phase 4A.

### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Proper 50 ทวิ PDF | Form-matching PDF replicating the official Revenue Department certificate |
| 2 | Bulk generation | Select period → generate all certificates for approved WHT payments |
| 3 | Certificate log | Register of all issued certificates with status tracking, search, download |
| 4 | Individual generation | Generate single certificate from payment/document detail |
| 5 | Void & reissue | Void an incorrect certificate and issue a replacement |

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF template | @react-pdf/renderer, form-matching layout | Consistent with 4A/4B, official form structure is fixed by RD |
| Storage | Supabase Storage (same bucket as reports) | Unified storage, same retention/cleanup system |
| Certificate numbering | Tenant-scoped sequential: `WHT-YYYY-NNNN` | Same pattern as JV numbering (JV-YYYY-NNNN) |
| Certificate log | New `wht_certificates` table (not report_history) | Certificates are individual documents, not period-based reports |
| Retention | Uses Phase 4A retention system (WHT category: 7 years default) | Legal compliance |
| UI | Sub-page under `/reports/wht` with tabs (Log + Bulk Generate) | Matches sidebar link |

---

## 1.1 Critical Implementation Notes

### Existing Code to Replace

The current implementation must be fully replaced:

- `src/lib/services/wht-pdf.ts` → `generate50TawiFile()` — currently outputs plain text to `public/generated/`. Replace with `@react-pdf/renderer` PDF uploaded to Supabase Storage.
- `src/app/api/tenants/[id]/wht-certificates/batch/route.ts` — currently generates text files per document. Replace with proper PDF batch generation that creates `wht_certificates` records.
- `documents.wht_certificate_path` field — currently stores path to text file in `public/`. **Deprecate this field.** The `wht_certificates.document_id` FK provides the bidirectional relationship. No need to store a reference on documents. Existing text file paths in this column can be ignored (they point to the old plain text files which are superseded).

### 50 ทวิ Form Structure (Official Revenue Department)

The form is standardized. Key sections:

1. **Header:** "หนังสือรับรองการหักภาษี ณ ที่จ่าย" with checkbox for original/copy
2. **Payer section (ผู้จ่ายเงิน):** Company name, tax ID, branch, address
3. **Payee section (ผู้รับเงิน):** Vendor name, tax ID, branch, address
4. **Income type checkboxes:** Based on Section 40 paragraphs (PND3) or corporate categories (PND53)
   - Uses `wht_income_type` from Phase 4B to auto-check the correct box
5. **Payment details table:**
   - Date of payment
   - Income type description
   - Amount paid
   - WHT rate
   - WHT amount withheld
6. **Totals:** Total amount paid, total WHT
7. **Filing reference:** ภ.ง.ด.3 or ภ.ง.ด.53 form number + filing month
8. **Signature area:** Payer signature, date, company stamp (blank for printing)

### Certificate Numbering

Sequential per tenant: `WHT-2026-0001`, `WHT-2026-0002`, etc.

Uses atomic counter approach identical to `src/lib/services/jv-number.ts`:
- Add `next_wht_sequence INTEGER DEFAULT 0 NOT NULL` to `tenants` table
- Use `UPDATE tenants SET next_wht_sequence = next_wht_sequence + 1 WHERE id = $1 RETURNING next_wht_sequence` for race-condition-free numbering
- Year prefix comes from current date, counter never resets (matches JV pattern — simpler, no year rollover logic)
- Format: `WHT-{YYYY}-{NNNN}` where NNNN is zero-padded from the atomic counter

### Payer (Company) Data Requirements

The official 50 ทวิ form requires the payer's full details: company name, tax ID, branch number, and address. The current `tenants` table is missing `address` and `branch_number` fields.

**Schema addition to `tenants` table:**
- `address` TEXT NULL — company address for official forms
- `branch_number` VARCHAR(20) NULL DEFAULT '00000' — head office or branch number

These fields are needed across all Phase 4 official forms (not just WHT certificates). They should be populated in Settings > Workspace before generating any official documents.

The `wht_certificates` table must also add:
- `payer_address` TEXT — snapshotted from tenant at generation time

---

## 2. UI Design

### 2.1 WHT Certificates Page (`/reports/wht`)

**Layout:** Two tabs — "Certificate Log" (default) and "Bulk Generate"

**Page header:**
- `h1`: "WHT Certificates" / "หนังสือรับรองการหักภาษี ณ ที่จ่าย"
- Action buttons: "Generate Certificate" (primary, single), "Export" (secondary)

### 2.2 Tab 1: Certificate Log

**Stat Cards (4-column grid):**

| Card 1 | Card 2 | Card 3 | Card 4 |
|--------|--------|--------|--------|
| Total Certificates (this month) | Total WHT Amount | Active | Voided |

**Filters (inline flex row):**
- Period: `<PeriodPicker>` (monthly, same as 4B)
- Search: text input (certificate number, vendor name, tax ID)
- Status: pill filter (All / Active / Voided)

**Data Table columns:**

| Column | Description |
|--------|-------------|
| Certificate No. | WHT-2026-0001 (link to PDF preview) |
| Date Issued | Certificate issue date |
| Payee | Vendor name |
| Tax ID | Vendor tax ID |
| Branch | Vendor branch |
| Income Type | WHT income category |
| Amount Paid | Total payment amount |
| WHT Rate | Rate applied |
| WHT Amount | Amount withheld |
| Form | ภ.ง.ด.3 / ภ.ง.ด.53 badge |
| Status | Active (green) / Voided (red) badge |
| Actions | Download / Void / View |

**Pagination:** 50 rows per page.

**Row click:** Opens PDF preview modal (same `<PdfPreviewModal>` from Phase 4A).

### 2.3 Tab 2: Bulk Generate

**Layout:**
1. Period selector (month/year)
2. Preview table: shows all approved documents with WHT for selected period that don't yet have a certificate
3. Checkbox column for selection (select all / individual)
4. Summary bar: "Selected: 15 certificates | Total WHT: ฿45,320.00"
5. "Generate Selected" button (primary)

**Preview table columns:**

| Column | Description |
|--------|-------------|
| Select | Checkbox |
| Document No. | Source document number |
| Date | Document date |
| Vendor | Vendor name |
| Tax ID | Vendor tax ID |
| Type | Individual / Company badge |
| Income Type | WHT income category |
| Amount | Payment amount |
| WHT Rate | Rate |
| WHT Amount | WHT withheld |
| Form | ภ.ง.ด.3 / ภ.ง.ด.53 (auto-determined) |

**Generation flow:**
1. User selects period → table loads uncertified WHT documents
2. User selects documents (or "Select All")
3. Click "Generate Selected"
4. Confirmation dialog: "Generate {N} WHT certificates for {month}? This will create {N} PDF files."
5. Progress bar during generation
6. Completion: "Generated {N} certificates. {M} new, {K} skipped (already certified)."
7. Auto-switch to Certificate Log tab showing new certificates

### 2.4 Single Certificate Generation

Triggered from:
- Payables page → payment row → "Generate 50 ทวิ" action
- Document detail → WHT section → "Generate Certificate" button
- Certificate Log → "Generate Certificate" button in header

**Flow:**
1. Opens modal with pre-filled data from document/payment
2. User reviews: payee info, income type, amount, rate
3. User can edit income type and rate if incorrect
4. Click "Generate" → creates PDF → saves to wht_certificates → opens preview

### 2.5 Void & Reissue

**Void flow:**
1. Certificate Log → row actions → "Void"
2. Confirmation dialog: "Void certificate WHT-2026-0015? Reason required."
3. Text input for void reason
4. On confirm: set `voided_at`, `voided_by`, `void_reason`. Certificate log shows strikethrough + red "Voided" badge.
5. The voided certificate PDF is kept (audit trail) but marked with "VOIDED" watermark.

**Reissue flow:**
1. After voiding, the source document becomes available for re-certification
2. Appears in Bulk Generate tab or can be generated individually
3. New certificate gets a new sequential number
4. `wht_certificates.replaces_id` links to the voided certificate for audit trail

---

## 3. Technical Architecture

### 3.1 Route Structure

```
src/app/(app)/reports/wht/
  page.tsx                      # WHT Certificates page with 2 tabs
```

Single page with tabs (not sub-pages) since the certificate log and bulk generate share the same data context.

### 3.2 API Routes

```
GET    /api/tenants/{id}/wht-certificates                    # List certificates (paginated, filterable)
POST   /api/tenants/{id}/wht-certificates                    # Generate single certificate
POST   /api/tenants/{id}/wht-certificates/batch              # Enhanced: bulk generate (replace existing)
GET    /api/tenants/{id}/wht-certificates/{certId}           # Get certificate detail
PATCH  /api/tenants/{id}/wht-certificates/{certId}           # Void certificate
GET    /api/tenants/{id}/wht-certificates/{certId}/pdf       # Download PDF (signed URL)
GET    /api/tenants/{id}/wht-certificates/uncertified        # List documents eligible for certification
```

All routes follow the existing auth pattern.

### 3.3 Database Schema

**`wht_certificates` table (NEW):**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, default gen_random_uuid() |
| tenant_id | UUID | FK → tenants, NOT NULL |
| certificate_no | VARCHAR(20) | NOT NULL, e.g. "WHT-2026-0001" |
| document_id | UUID | FK → documents, NOT NULL |
| payment_id | UUID | FK → payments, NULL (if generated from document, not payment) |
| vendor_id | UUID | FK → vendors, NULL (if vendor matched) |
| form_type | VARCHAR(10) | NOT NULL: 'pnd3' or 'pnd53' |
| payee_name | TEXT | NOT NULL (snapshot at generation time) |
| payee_tax_id | VARCHAR(13) | NOT NULL |
| payee_branch | VARCHAR(20) | Default '00000' |
| payee_address | TEXT | NULL |
| payer_name | TEXT | NOT NULL (tenant company name) |
| payer_tax_id | VARCHAR(13) | NOT NULL (tenant tax ID) |
| payer_address | TEXT | Snapshotted from tenant |
| payer_branch | VARCHAR(20) | From tenant.branch_number or '00000' |
| income_type | VARCHAR(50) | NOT NULL (e.g. 'ค่าบริการ') |
| income_section | VARCHAR(20) | NOT NULL (e.g. '40(2)' for PND3, type '2' for PND53) |
| payment_date | DATE | NOT NULL |
| amount_paid | DECIMAL(15,2) | NOT NULL |
| wht_rate | DECIMAL(5,2) | NOT NULL |
| wht_amount | DECIMAL(15,2) | NOT NULL |
| pdf_storage_path | TEXT | Supabase Storage path |
| pdf_size_bytes | INTEGER | |
| issued_at | TIMESTAMP | DEFAULT now() |
| issued_by | UUID | FK → profiles |
| voided_at | TIMESTAMP | NULL |
| voided_by | UUID | FK → profiles, NULL |
| void_reason | TEXT | NULL |
| replaces_id | UUID | FK → wht_certificates (self-ref), NULL |
| expires_at | TIMESTAMP | Computed from WHT retention policy |
| deleted_at | TIMESTAMP | NULL (soft delete for retention cleanup) |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

**Indexes:**
- `UNIQUE (tenant_id, certificate_no)` — no duplicate certificate numbers
- `INDEX (tenant_id, document_id) WHERE voided_at IS NULL` — fast lookup for "is this document certified?"
- `INDEX (tenant_id, issued_at)` — for period-based queries

**Note:** Certificate data is **snapshotted** at generation time (payee_name, payee_tax_id, etc.) rather than referencing vendors directly. This ensures the certificate remains accurate even if vendor master data is later edited.

### 3.4 Services

**Replace `src/lib/services/wht-pdf.ts`:**

```
src/lib/services/
  wht-certificate.ts           # Certificate generation orchestrator
  wht-certificate-pdf.ts       # @react-pdf/renderer template for 50 ทวิ form
  wht-certificate-number.ts    # Sequential numbering (WHT-YYYY-NNNN)
```

**`wht-certificate.ts` flow:**
1. Receive: `{ tenantId, documentId, paymentId?, incomeType?, whtRate? }`
2. Load document + matched vendor (for address, branch, type)
3. Determine form_type via `getWhtFormType()` from Phase 4B
4. Generate next certificate number: `WHT-{YYYY}-{NNNN}`
5. Snapshot payee/payer data into certificate record
6. Render PDF using `@react-pdf/renderer`
7. Upload to Supabase Storage: `{tenantId}/wht-certificates/{certificateNo}.pdf`
8. Insert `wht_certificates` row
9. Update `documents.wht_certificate_path` with certificate ID
10. Return: `{ certificateId, certificateNo, pdfUrl }`

**`wht-certificate-number.ts`:**
Same pattern as `src/lib/services/jv-number.ts`:
```typescript
export async function generateWhtCertificateNumber(tenantId: string): Promise<string> {
  // Query max certificate_no for current year
  // Increment, zero-pad to 4 digits
  // Return: WHT-2026-0001
}
```

### 3.5 Database Queries

```
src/lib/db/queries/
  wht-certificates.ts          # CRUD, list, void, stats, uncertified documents query
```

**Key queries:**

**List certificates:**
```sql
SELECT * FROM wht_certificates
WHERE tenant_id = $1
AND issued_at BETWEEN $2 AND $3
AND ($4 IS NULL OR (certificate_no ILIKE $4 OR payee_name ILIKE $4 OR payee_tax_id ILIKE $4))
AND ($5 IS NULL OR (CASE WHEN $5 = 'active' THEN voided_at IS NULL ELSE voided_at IS NOT NULL END))
AND deleted_at IS NULL
ORDER BY issued_at DESC
LIMIT $6 OFFSET $7
```

**Uncertified documents (for bulk generate):**
```sql
SELECT d.id, d.document_number, d.document_date, d.issuer_name, d.issuer_tax_id,
  d.wht_amount, d.wht_rate, d.wht_income_type,
  v.vendor_type, v.is_non_resident, v.branch_number, v.address
FROM documents d
LEFT JOIN vendors v ON v.tenant_id = d.tenant_id AND v.tax_id = d.issuer_tax_id
WHERE d.tenant_id = $1
AND d.status = 'APPROVED'
AND d.wht_amount > 0
AND d.document_date BETWEEN $2 AND $3
AND NOT EXISTS (
  SELECT 1 FROM wht_certificates wc
  WHERE wc.document_id = d.id AND wc.voided_at IS NULL AND wc.deleted_at IS NULL
)
ORDER BY d.document_date
```

### 3.6 React Query Hooks

```
src/lib/hooks/
  use-wht-certificates.ts      # List, stats, generate, void, download mutations
  use-wht-uncertified.ts       # Uncertified documents for bulk generate
```

### 3.7 Components

No new shared components needed. Reuses:
- `<DataTable>` with checkbox column for bulk selection
- `<PdfPreviewModal>` from Phase 4A
- `<PeriodPicker>` (monthly only)
- `<Modal>` for single generation and void confirmation
- `<Badge>` for status and form type
- `<Pagination>`

### 3.8 PDF Template

**`wht-certificate-pdf.ts` — Form-matching 50 ทวิ template:**

```
<Document>
  <Page size="A4" style={styles.page}>
    {/* Form title: หนังสือรับรองการหักภาษี ณ ที่จ่าย */}
    {/* Checkbox: ต้นฉบับ / สำเนา */}

    {/* Payer section */}
    {/* Box: company name, tax ID (formatted XX-XXXX-XXXXX-XX-X), branch, address */}

    {/* Payee section */}
    {/* Box: vendor name, tax ID, branch, address */}

    {/* Income type checkboxes */}
    {/* For PND3: Section 40(1) through 40(8) checkboxes */}
    {/* For PND53: Corporate income type checkboxes */}
    {/* Auto-check based on income_section field */}

    {/* Payment detail table */}
    {/* Columns: date, type description, amount paid, WHT withheld */}

    {/* Totals row */}

    {/* Filing reference: filed with ภ.ง.ด.3/53, month YYYY */}

    {/* Signature area: blank line, date, stamp area */}
  </Page>
</Document>
```

**Font:** Noto Sans Thai (Regular + Bold), registered via `Font.register()`.

**Tax ID formatting:** Display as `X-XXXX-XXXXX-XX-X` (standard Thai tax ID format with dashes).

**Voided certificate:** Same PDF but with large "เป็นโมฆะ" (VOIDED) watermark diagonally across the page, rendered as a rotated `<Text>` with low opacity.

---

## 4. Cross-Phase File Impact

### 4.1 Files to Replace

| File | Action |
|------|--------|
| `src/lib/services/wht-pdf.ts` | Keep `detectWht()` function (used by OCR pipeline). Replace `generate50TawiFile()` with new `wht-certificate.ts` service. |
| `src/app/api/tenants/[id]/wht-certificates/batch/route.ts` | Full rewrite: use new service, create `wht_certificates` records |

### 4.2 Files to Update

| File | Change | Complexity |
|------|--------|-----------|
| `src/lib/db/schema.ts` | Add `wht_certificates` table + `next_wht_sequence` on tenants + `address`/`branch_number` on tenants | HIGH |
| `src/components/sidebar.tsx` | No change needed — `/reports/wht` link already exists | NONE |
| `src/app/(app)/payables/page.tsx` | Add "Generate 50 ทวิ" action to payment rows (optional, can be Phase 5) | LOW |
| `src/lib/utils/constants.ts` | Add `REPORT_RETENTION_CATEGORY` entry: `wht_certificate: 'wht'` | LOW |

### 4.3 Files to Create

| File | Purpose |
|------|---------|
| `src/app/(app)/reports/wht/page.tsx` | WHT Certificates page (2 tabs) |
| `src/lib/services/wht-certificate.ts` | Certificate generation orchestrator |
| `src/lib/services/wht-certificate-pdf.ts` | @react-pdf/renderer 50 ทวิ template |
| `src/lib/services/wht-certificate-number.ts` | Sequential numbering |
| `src/lib/db/queries/wht-certificates.ts` | CRUD, list, void, stats, uncertified |
| `src/lib/hooks/use-wht-certificates.ts` | React Query hooks |
| `src/lib/hooks/use-wht-uncertified.ts` | Uncertified documents hook |
| `src/app/api/tenants/[id]/wht-certificates/route.ts` | List + single generate |
| `src/app/api/tenants/[id]/wht-certificates/[certId]/route.ts` | Get + void |
| `src/app/api/tenants/[id]/wht-certificates/[certId]/pdf/route.ts` | PDF download |
| `src/app/api/tenants/[id]/wht-certificates/uncertified/route.ts` | Uncertified documents |

---

## 5. Data Flow

### 5.1 Single Certificate Generation

```
User clicks "Generate 50 ทวิ" → Modal with pre-filled data →
User reviews/edits → POST /wht-certificates { documentId, incomeType, whtRate } →
Server: load document + vendor → determine form_type → generate cert number →
Snapshot data → render PDF → upload to Storage → insert wht_certificates row →
Return { certId, certNo, pdfUrl } → Preview modal opens
```

### 5.2 Bulk Generation

```
User selects period → GET /wht-certificates/uncertified?period=2026-03 →
Shows uncertified documents with checkboxes →
User selects → POST /wht-certificates/batch { documentIds: [...] } →
Server: for each document → generate cert (same flow as single) →
Return { generated: N, skipped: M } → Switch to Certificate Log tab
```

### 5.3 Void & Reissue

```
User clicks Void → PATCH /wht-certificates/{id} { action: 'void', reason: '...' } →
Server: set voided_at, voided_by, void_reason →
Re-render PDF with "เป็นโมฆะ" watermark → update stored PDF →
Document becomes eligible for re-certification →
User generates new certificate → replaces_id links to voided cert
```

### 5.4 Retention & Cleanup

WHT certificates use the Phase 4A retention system:
- `expires_at` computed from tenant's WHT retention policy (default 7 years)
- Daily cleanup cron handles `wht_certificates` table same as `report_history`
- Soft delete → trash recovery → permanent delete

**Cleanup job update:** The existing `report-cleanup.ts` Inngest function must be extended to also process the `wht_certificates` table (same logic: check expires_at, soft delete, then permanent delete after trash recovery period).

---

## 6. Error Handling

- **Duplicate certification:** If a document already has an active (non-voided) certificate, reject with "Document already has certificate WHT-2026-0015. Void it first to reissue."
- **Missing vendor data:** If vendor not in master data, allow generation with document-level data (issuerName, issuerTaxId) but show warning about missing address
- **Batch generation failure:** If any single certificate fails, continue with remaining. Return summary: `{ generated: 12, failed: 2, errors: [...] }`
- **Certificate number collision:** Use database-level unique constraint + retry with next number on conflict
- **PDF rendering failure:** Retry once, then return error for that specific certificate

---

## 7. Additional Specifications

### 7.1 Unmatched Vendor — Form Type Selection

When generating a certificate for a document with no matched vendor (issuerTaxId not in vendors table), the system cannot auto-determine PND3 vs PND53. In this case:
- **Single generation modal:** Show a required "Vendor Type" dropdown (Individual / Company) for the user to select manually
- **Bulk generation:** Documents with unmatched vendors are shown with a warning badge and vendor type defaults to 'company' (PND53). User can override per row before generating.
- The selected type is stored on the certificate record regardless of vendor match status.

### 7.2 Void PDF Overwrite

When voiding a certificate, the PDF is re-rendered with the "เป็นโมฆะ" watermark and **overwrites the existing file at the same Storage path**. This avoids orphaned files and keeps the same `pdf_storage_path` value. Signed URL regeneration will serve the updated (voided) PDF.

### 7.3 Batch Generation Concurrency

For batches larger than 10 documents, use an Inngest background job:
- API immediately returns a `batch_id` with status `processing`
- Inngest job generates certificates sequentially (to maintain numbering order)
- UI polls `GET /wht-certificates/batch/{batchId}/status` for progress
- Progress response: `{ total: 50, completed: 23, failed: 0, status: 'processing' }`
- Maximum batch size: 200. Requests exceeding this are rejected.
- For batches of 10 or fewer, generate synchronously in the API route.

### 7.4 WHT Certificate Retention

WHT certificates use the `wht_retention_value` / `wht_retention_unit` from the `report_retention_policy` table directly (not via `REPORT_RETENTION_CATEGORY` mapping, since certificates live in `wht_certificates` table, not `report_history`).

A utility function `computeWhtCertificateExpiry(tenantId)` reads the tenant's WHT retention policy and returns the `expires_at` timestamp. Used by `wht-certificate.ts` when creating certificates.

The cleanup job (`report-cleanup.ts`) is extended with an additional step to process the `wht_certificates` table using the same expires_at / deleted_at / trash_recovery_days logic.

### 7.5 Tenant Settings Validation

Before generating any WHT certificate, validate that the tenant has:
- `name` (company name) — NOT NULL, already required
- `tax_id` — NOT NULL, already required
- `address` — NEW, required for official forms
- `branch_number` — NEW, defaults to '00000'

If `address` is missing, show error: "Please complete your company address in Settings > Workspace before generating official documents."

---

## 8. Role-Based Access (same as Phase 4A/4B)

| Action | admin | maker | checker | viewer |
|--------|:---:|:---:|:---:|:---:|
| View certificate log | Y | Y | Y | Y |
| Download PDF | Y | Y | Y | Y |
| Generate single certificate | Y | Y | — | — |
| Bulk generate | Y | Y | — | — |
| Void certificate | Y | — | Y | — |

---

## 8. Testing Considerations

### Thai Compliance Checks

- [ ] PDF form layout matches official Revenue Department 50 ทวิ form (compare with printed original)
- [ ] Tax ID formatted as X-XXXX-XXXXX-XX-X
- [ ] Income type checkboxes correctly auto-checked based on income_section
- [ ] PND3 certificates use Section 40 classification
- [ ] PND53 certificates use corporate classification
- [ ] Certificate numbering is sequential with no gaps (except voided)
- [ ] Voided certificates show "เป็นโมฆะ" watermark clearly
- [ ] Reissued certificate links to voided original via replaces_id
- [ ] Branch number displays correctly (00000 = สำนักงานใหญ่)
- [ ] All amounts display with 2 decimal places, Thai Baht
- [ ] Payer info (company) matches tenant profile data
- [ ] Payee data is snapshotted (editing vendor later doesn't change issued certificate)

---

## 9. Scope Exclusions

- **E-filing submission** — direct upload to rd.go.th (future)
- **Email certificates** — send PDF to vendor via email (future)
- **QR code on certificate** — some companies add QR for verification (future)
- **Multi-payment certificates** — one certificate covering multiple payments to same vendor in one month (can be added as enhancement)
