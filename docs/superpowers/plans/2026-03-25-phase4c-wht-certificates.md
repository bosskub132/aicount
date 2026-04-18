# Phase 4C: WHT Certificates (50 ทวิ) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain-text WHT certificate generator with proper PDF 50 ทวิ form, add bulk generation, certificate log with void/reissue, and tenant company profile for payer data.

**Architecture:** Single page at `/reports/wht` with two tabs (Certificate Log + Bulk Generate). Certificates are individual legal documents stored in `wht_certificates` table (separate from report_history). PDFs match official Revenue Department 50 ทวิ form. Atomic sequential numbering (WHT-YYYY-NNNN). Void/reissue with audit trail. Bulk generation via Inngest for large batches.

**Tech Stack:** Same as Phase 4A/4B + Inngest for batch processing.

**Spec:** `docs/superpowers/specs/2026-03-25-phase4c-wht-certificates-design.md`
**Depends on:** Phase 4B complete (vendor_type, wht_income_type, wht_rate fields)

---

## File Structure

### New Files

**Queries:**
- `src/lib/db/queries/wht-certificates.ts`

**Services:**
- `src/lib/services/wht-certificate.ts` — orchestrator
- `src/lib/services/wht-certificate-pdf.ts` — @react-pdf/renderer 50 ทวิ template
- `src/lib/services/wht-certificate-number.ts` — atomic sequential numbering

**Hooks:**
- `src/lib/hooks/use-wht-certificates.ts`
- `src/lib/hooks/use-wht-uncertified.ts`

**Pages:**
- `src/app/(app)/reports/wht/page.tsx`

**API Routes:**
- `src/app/api/tenants/[id]/wht-certificates/route.ts` — list + single generate (rewrite)
- `src/app/api/tenants/[id]/wht-certificates/batch/route.ts` — bulk generate (rewrite)
- `src/app/api/tenants/[id]/wht-certificates/[certId]/route.ts` — get + void
- `src/app/api/tenants/[id]/wht-certificates/[certId]/pdf/route.ts` — PDF download
- `src/app/api/tenants/[id]/wht-certificates/uncertified/route.ts` — eligible documents

**Background Job:**
- `src/lib/inngest/functions/wht-batch-generate.ts`

### Files to Modify

- `src/lib/db/schema.ts` — Add `wht_certificates` table + `next_wht_sequence`, `address`, `branch_number` on tenants
- `src/lib/services/wht-pdf.ts` — Keep `detectWht()`, remove `generate50TawiFile()`
- `src/lib/inngest/functions/report-cleanup.ts` — Extend to process `wht_certificates` table
- `src/lib/inngest/index.ts` — Register new batch generate function

---

## Task Breakdown

### Task 1: Schema — wht_certificates table + tenant fields

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add tenant company profile fields**

In the `tenants` table definition, add:
```typescript
address: text("address"),
branchNumber: varchar("branch_number", { length: 20 }).default("00000"),
nextWhtSequence: integer("next_wht_sequence").default(0).notNull(),
```

- [ ] **Step 2: Add wht_certificates table**

```typescript
export const whtCertificates = pgTable(
  "wht_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    certificateNo: varchar("certificate_no", { length: 20 }).notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    paymentId: uuid("payment_id").references(() => payments.id),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    formType: varchar("form_type", { length: 10 }).notNull(), // pnd3, pnd53
    payeeName: text("payee_name").notNull(),
    payeeTaxId: varchar("payee_tax_id", { length: 13 }).notNull(),
    payeeBranch: varchar("payee_branch", { length: 20 }).default("00000"),
    payeeAddress: text("payee_address"),
    payerName: text("payer_name").notNull(),
    payerTaxId: varchar("payer_tax_id", { length: 13 }).notNull(),
    payerAddress: text("payer_address"),
    payerBranch: varchar("payer_branch", { length: 20 }).default("00000"),
    incomeType: varchar("income_type", { length: 50 }).notNull(),
    incomeSection: varchar("income_section", { length: 20 }).notNull(),
    paymentDate: date("payment_date").notNull(),
    amountPaid: decimal("amount_paid", { precision: 15, scale: 2 }).notNull(),
    whtRate: decimal("wht_rate", { precision: 5, scale: 2 }).notNull(),
    whtAmount: decimal("wht_amount", { precision: 15, scale: 2 }).notNull(),
    pdfStoragePath: text("pdf_storage_path"),
    pdfSizeBytes: integer("pdf_size_bytes"),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    issuedBy: uuid("issued_by").references(() => profiles.id),
    voidedAt: timestamp("voided_at"),
    voidedBy: uuid("voided_by").references(() => profiles.id),
    voidReason: text("void_reason"),
    replacesId: uuid("replaces_id"),
    expiresAt: timestamp("expires_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wht_cert_tenant_no_idx").on(table.tenantId, table.certificateNo),
    index("wht_cert_doc_idx").on(table.tenantId, table.documentId),
  ]
);
```

- [ ] **Step 3: Generate migration**

Run: `npx drizzle-kit generate`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add wht_certificates table and tenant company profile fields"
```

---

### Task 2: Certificate numbering service

**Files:**
- Create: `src/lib/services/wht-certificate-number.ts`

- [ ] **Step 1: Create atomic numbering service**

```typescript
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";

export async function generateWhtCertificateNumber(tenantId: string): Promise<string> {
  const result = await db
    .update(tenants)
    .set({ nextWhtSequence: sql`${tenants.nextWhtSequence} + 1` })
    .where(eq(tenants.id, tenantId))
    .returning({ seq: tenants.nextWhtSequence });

  const seq = result[0].seq;
  const year = new Date().getFullYear();
  return `WHT-${year}-${String(seq).padStart(4, "0")}`;
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add atomic WHT certificate numbering service"
```

---

### Task 3: Certificate PDF template

**Files:**
- Create: `src/lib/services/wht-certificate-pdf.ts`

- [ ] **Step 1: Create 50 ทวิ form-matching PDF template**

Register Noto Sans Thai font. Create `WhtCertificatePdf` component matching official RD form:
- Header: "หนังสือรับรองการหักภาษี ณ ที่จ่าย"
- Payer section: name, tax ID (X-XXXX-XXXXX-XX-X format), branch, address
- Payee section: same layout
- Income type checkboxes (auto-checked by income_section)
- Payment detail table: date, type, amount paid, WHT withheld
- Totals
- Filing reference + signature area

- [ ] **Step 2: Create voided variant**

Same template but with large "เป็นโมฆะ" watermark (rotated text, low opacity).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add 50 ทวิ form-matching PDF template with voided variant"
```

---

### Task 4: Certificate orchestrator service

**Files:**
- Create: `src/lib/services/wht-certificate.ts`
- Modify: `src/lib/services/wht-pdf.ts`

- [ ] **Step 1: Create wht-certificate.ts**

Functions:
- `generateCertificate({ tenantId, documentId, paymentId?, incomeType?, whtRate? })` — full flow: load doc + vendor + tenant → determine form type → generate number → snapshot data → render PDF → upload to Storage → insert record → return result
- `voidCertificate(tenantId, certId, reason, userId)` — set voided fields → re-render PDF with watermark → overwrite at same Storage path
- Validate tenant has address before generating (error if missing)

- [ ] **Step 2: Remove generate50TawiFile from wht-pdf.ts**

Keep `detectWht()` intact. Remove the `generate50TawiFile()` function and its filesystem imports.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add WHT certificate orchestrator service, remove legacy text generator"
```

---

### Task 5: Certificate queries

**Files:**
- Create: `src/lib/db/queries/wht-certificates.ts`

- [ ] **Step 1: Create query module**

Functions:
- `listCertificates(tenantId, filters)` — paginated, filterable by period/search/status
- `getCertificate(tenantId, certId)` — single record
- `getCertificateStats(tenantId, period)` — total count, total WHT, active count, voided count
- `listUncertifiedDocuments(tenantId, period)` — documents with WHT but no active certificate
- `insertCertificate(data)` — insert record
- `voidCertificate(tenantId, certId, reason, userId)` — set voided_at/by/reason
- `checkDuplicate(tenantId, documentId)` — check if active cert exists for document

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add WHT certificate query module"
```

---

### Task 6: API routes

**Files:**
- Rewrite: `src/app/api/tenants/[id]/wht-certificates/route.ts`
- Rewrite: `src/app/api/tenants/[id]/wht-certificates/batch/route.ts`
- Create: `src/app/api/tenants/[id]/wht-certificates/[certId]/route.ts`
- Create: `src/app/api/tenants/[id]/wht-certificates/[certId]/pdf/route.ts`
- Create: `src/app/api/tenants/[id]/wht-certificates/uncertified/route.ts`

- [ ] **Step 1: Rewrite list + single generate route**

GET: list certificates with pagination + filters.
POST: generate single certificate — validate, call orchestrator, return result.

- [ ] **Step 2: Rewrite batch route**

POST: accept `{ documentIds: string[], period: string }`. If <= 10 documents, generate synchronously. If > 10, dispatch Inngest job and return batch_id for polling.

- [ ] **Step 3: Create cert detail route**

GET: single certificate detail.
PATCH: `{ action: "void", reason: "..." }` — call voidCertificate.

- [ ] **Step 4: Create PDF download route**

GET: generate signed URL for certificate PDF from Supabase Storage, redirect or return URL.

- [ ] **Step 5: Create uncertified documents route**

GET: list documents eligible for certification for a period. Accept `period` query param.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add WHT certificate API routes (list, generate, void, download, uncertified)"
```

---

### Task 7: Batch generation Inngest job

**Files:**
- Create: `src/lib/inngest/functions/wht-batch-generate.ts`

- [ ] **Step 1: Create batch generation function**

Triggered by API with `{ tenantId, documentIds, batchId, userId }`. Generates certificates sequentially (for numbering order). Tracks progress: `{ total, completed, failed }`. Stores progress in a lightweight mechanism (could use Inngest step metadata or a simple cache).

- [ ] **Step 2: Register in Inngest client**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add Inngest batch WHT certificate generation job"
```

---

### Task 8: Extend cleanup cron for wht_certificates

**Files:**
- Modify: `src/lib/inngest/functions/report-cleanup.ts`

- [ ] **Step 1: Add wht_certificates processing**

After processing `report_history`, also process `wht_certificates`:
- Step 1: Move expired certs to trash (deleted_at)
- Step 2: Permanently delete certs past trash recovery (per-tenant)
- Step 3: Delete PDFs from Storage for permanently deleted certs

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: extend cleanup cron to process wht_certificates table"
```

---

### Task 9: React Query hooks

**Files:**
- Create: `src/lib/hooks/use-wht-certificates.ts`
- Create: `src/lib/hooks/use-wht-uncertified.ts`

- [ ] **Step 1: Create use-wht-certificates.ts**

- `useWhtCertificates(tenantId, filters)` — list query
- `useWhtCertificateStats(tenantId, period)` — stats query
- `useGenerateCertificate()` — mutation
- `useVoidCertificate()` — mutation
- `useBatchGenerate()` — mutation

- [ ] **Step 2: Create use-wht-uncertified.ts**

- `useUncertifiedDocuments(tenantId, period)` — list query

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add React Query hooks for WHT certificates"
```

---

### Task 10: WHT Certificates page

**Files:**
- Create: `src/app/(app)/reports/wht/page.tsx`

- [ ] **Step 1: Create page with 2 tabs**

Tab 1: Certificate Log
- Stat cards: total certs, total WHT, active, voided
- Filters: PeriodPicker (monthly), search input, status pills
- DataTable: cert no, date, payee, tax ID, branch, income type, amount, rate, WHT, form badge, status badge, actions
- Row click → PdfPreviewModal
- Actions: Download, Void, View

Tab 2: Bulk Generate
- Period selector
- Uncertified documents table with checkboxes
- Summary bar: "Selected: N | Total WHT: ฿X"
- "Generate Selected" button → confirmation → progress → switch to Log tab

- [ ] **Step 2: Add void confirmation modal**

Modal with reason text input. "Void certificate WHT-2026-XXXX?" + warning.

- [ ] **Step 3: Add single generate modal**

Pre-filled from document data. Editable income type + rate. Review → Generate.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add WHT Certificates page with certificate log and bulk generate"
```

---

### Task 11: Integration testing & polish

- [ ] **Step 1: Test single certificate generation end-to-end**
- [ ] **Step 2: Test bulk generation (small batch sync + large batch via Inngest)**
- [ ] **Step 3: Test void and reissue flow**
- [ ] **Step 4: Test certificate numbering is sequential with no gaps**
- [ ] **Step 5: Test PDF matches official 50 ทวิ form layout**
- [ ] **Step 6: Test tenant address validation (block generation if missing)**
- [ ] **Step 7: Test cleanup cron processes wht_certificates**
- [ ] **Step 8: Verify build passes**

Run: `npx next build`

- [ ] **Step 9: Final commit**

```bash
git commit -m "feat: Phase 4C WHT Certificates complete — 50 ทวิ PDF, bulk generate, void/reissue"
```
