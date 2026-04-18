# Phase 6A: Extraction Accuracy Overhaul

**Date:** 2026-03-31
**Status:** Design approved
**Depends on:** Phase 5 (complete)
**Feeds into:** Phase 6B (AI Foundation), 6C (Inline Suggestions), 6D (Chat + Learning)

## Problem Statement

User feedback and real-world testing revealed critical extraction accuracy failures:

1. **Thai date parsing** — Buddhist Era short year "2/8/24" extracted as "1902-08-24" instead of "2024-08-02" (BE 2567)
2. **Number format confusion** — Thai invoices use mixed comma/period formatting. "1,750,000,00" parsed as 175,000,000 instead of 1,750,000.00
3. **Invoice number misread** — Regex grabs "OICE" from the word "INVOICE" instead of actual document number
4. **VAT amount wrong** — Extracts "7" from "7%" label instead of the actual VAT amount
5. **Field misassignment** — Regex puts data in wrong fields (tax ID → price, customer name → seller name)
6. **Line item parsing** — Unreliable quantity/price extraction from table-formatted data
7. **Early termination** — Pipeline stops when signals are weak, doesn't retry with better strategy
8. **Missing fields** — Customer tax ID, discounts, reference PO not extracted

Root cause: The regex-based parsing layer cannot handle the diversity of Thai invoice templates. Regex is brittle — every new template style breaks it.

## Solution: Three-Tier AI Extraction Pipeline

Replace regex-based field extraction with Claude LLM parsing. Keep Google Vision for raw Thai text extraction (where it excels), use Claude for semantic field understanding.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Document Upload                            │
│                         ↓                                    │
│              Google Vision API                               │
│              (DOCUMENT_TEXT_DETECTION)                        │
│              Returns: raw Thai/English text                   │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Tier 1: Claude Haiku                                    │ │
│  │                                                         │ │
│  │  Input: raw text + base prompt + learned rules from DB  │ │
│  │  Output: structured JSON extraction                     │ │
│  │  Cost: ~$0.004                                          │ │
│  │                                                         │ │
│  │  → Confidence check + 4-level amount validation         │ │
│  │  → PASS: proceed to classification & journal generation │ │
│  └─────────────┬───────────────────────────────────────────┘ │
│                │ FAIL: confidence < 0.70                     │
│                │   OR critical field < 0.50                  │
│                │   OR amount validation fails                │
│                ↓                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Tier 2: Claude Sonnet (text re-parse)                   │ │
│  │                                                         │ │
│  │  Input: same raw text + Tier 1 result + failure reasons │ │
│  │  Cost: +$0.01                                           │ │
│  │                                                         │ │
│  │  → Same validation checks                               │ │
│  │  → PASS: proceed                                        │ │
│  └─────────────┬───────────────────────────────────────────┘ │
│                │ FAIL: still low confidence                  │
│                ↓                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Tier 3: Claude Sonnet Vision (image re-OCR)             │ │
│  │                                                         │ │
│  │  Input: original image + raw text as reference          │ │
│  │         + Tier 1 & 2 results + failure reasons          │ │
│  │  Cost: +$0.02-0.03                                      │ │
│  │                                                         │ │
│  │  → Best-effort result, always proceed                   │ │
│  │  → Mark requires_manual_review if still low             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                         ↓                                    │
│            Classification → Journal Generation               │
│                         ↓                                    │
│              Status Assignment → Done                        │
└──────────────────────────────────────────────────────────────┘
```

### Cost Estimates

| Tier | Model | Est. Cost | % of Documents |
|---|---|---|---|
| Tier 1 | Google Vision + Haiku | ~$0.004 | ~70-80% resolve here |
| Tier 2 | Sonnet (text only) | +$0.01 | ~15-25% escalate |
| Tier 3 | Sonnet Vision (image) | +$0.02-0.03 | ~5% worst cases |
| **Blended average** | | **~$0.007/doc** | |

At 500 docs/month (Professional tier) = ~$3.50/month AI cost vs ฿1,499 subscription.

### What Gets Removed

- Regex-based field extraction from Google Vision raw text (`parseGoogleVisionText()` and related regex functions)
- Old Claude two-tier OCR prompt system (Tier 1/Tier 2 prompt files)
- Hardcoded confidence values for Google Vision path (0.7/0.35)

### What Stays

- Google Vision API call for raw text (DOCUMENT_TEXT_DETECTION) — unchanged
- Simple format validators (post-extraction sanity checks, not field extraction):
  - Tax ID: exactly 13 digits, numeric only
  - Date range: year must be 2020-2030 CE (or 2563-2573 BE)
  - Currency: must be valid ISO 4217 code (default THB)
  - Amounts: must be non-negative, finite numbers
  - VAT rate: 0% or 7% for Thailand
- Confidence scoring system (recalibrated for new pipeline)
- Classification logic (direction, docType, journalType) — unchanged
- GL mapping and journal generation — unchanged

---

## Extraction Field Schema

### Current Fields vs New Fields

| Section | Field | Status | Priority |
|---|---|---|---|
| **Issuer** | name, tax_id, branch_id, address, postal_code | Existing | — |
| **Customer** | name, branch_id, address, postal_code | Existing | — |
| **Customer** | **tax_id** | **NEW** | Required |
| **Document** | document_type, invoice_number, issue_date, due_date, credit_days | Existing | — |
| **Document** | **reference_po** | **NEW** | Nice-to-have |
| **Document** | **credit_due_date** | **NEW** | Nice-to-have |
| **Amounts** | net_amount_ex_vat, vat_amount, total_amount, currency, is_vat_included | Existing | — |
| **Amounts** | **discount_amount** | **NEW** | Required |
| **Line Items** | description, quantity, unit_price, total, category | Existing | — |
| **Line Items** | **discount** | **NEW** | Required |
| **WHT** | wht_rate, wht_amount, wht_income_type | Existing | — |

### New Field Details

1. **`customer.tax_id`** — For expense: buyer mismatch check. For revenue: required for sales VAT register and tax reporting.

2. **`document.reference_po`** — PO number reference on purchase invoices. Thai keywords: "อ้างถึงใบสั่งซื้อ", "PO", "Purchase Order".

3. **`document.credit_due_date`** — Either extracted directly or calculated: `issue_date + credit_days`. Thai keywords: "วันครบกำหนด", "Due Date". Feeds into AP aging.

4. **`amounts.discount_amount`** — Invoice-level discount (separate from line item discounts). Thai keywords: "ส่วนลด", "Discount". Affects subtotal: `sum(line_items) - discount = subtotal`.

5. **`line_items[].discount`** — Per-item discount. Validation: `qty × unit_price - discount ≈ total` per line.

### Enhanced Amount Validation (4-level)

```
Level 1 — Line item:    qty × unit_price - item_discount ≈ item_total     (per line)
Level 2 — Subtotal:     sum(item_totals) - invoice_discount ≈ subtotal
Level 3 — VAT:          subtotal × 0.07 ≈ vat_amount                      (if normal VAT)
Level 4 — Grand total:  subtotal + vat_amount ≈ total_amount
```

Each level produces independent pass/fail. Multiple failures strengthen the escalation signal.

### Database Schema Changes

```sql
-- documents table additions
ALTER TABLE documents ADD COLUMN customer_tax_id TEXT;
ALTER TABLE documents ADD COLUMN reference_po TEXT;
ALTER TABLE documents ADD COLUMN credit_due_date DATE;
ALTER TABLE documents ADD COLUMN discount_amount NUMERIC(15,2) DEFAULT 0;

-- Extraction status tracking
ALTER TABLE documents ADD COLUMN extraction_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN extraction_failure_reason TEXT;

-- Line item discount stored in ocrRaw JSONB (no table change needed)
```

`extraction_status` values: `pending`, `processing`, `completed`, `partial`, `failed`, `manual`.

---

## Prompt Design

### Base Extraction Prompt (Tier 1 — Claude Haiku)

```
You are a Thai accounting document parser. Extract structured data from this OCR text.

## Rules
- Dates: Thai Buddhist Era (พ.ศ.) subtract 543 for CE. Short year "67" = 2567 BE = 2024 CE.
  "24" on a recent document = 2567 BE = 2024 CE, NOT 1924.
- Numbers: Thai invoices use mixed formats. "1,750,000.00" and "1,750,000,00" both mean
  1.75 million. Use context (nearby labels, position) to determine decimal point.
- Tax ID: Always 13 digits. If you see a 13-digit number near "เลขประจำตัวผู้เสียภาษี"
  or "TAX ID", that's the tax ID — not a price or reference number.
- Invoice number: The document's own number, NOT the word "INVOICE" itself. Look for
  "เลขที่" or "#" or "No." followed by the actual number.
- VAT: Thailand standard rate is 7%. If you see "7%" near "ภาษีมูลค่าเพิ่ม", extract
  the AMOUNT next to it, not "7".
- Currency: Default THB unless explicitly stated otherwise.
- Discount: May appear at item level AND invoice level. Both are separate fields.

## Output JSON Schema
{
  "issuer": { "name", "tax_id", "branch_id", "address", "postal_code" },
  "customer": { "name", "tax_id", "branch_id", "address", "postal_code" },
  "document": {
    "document_type", "invoice_number", "issue_date", "due_date",
    "credit_days", "credit_due_date", "reference_po"
  },
  "amounts": {
    "net_amount_ex_vat", "vat_amount", "total_amount",
    "discount_amount", "currency", "is_vat_included"
  },
  "line_items": [
    { "description", "quantity", "unit_price", "discount", "total", "category" }
  ],
  "confidence": {
    "overall": 0.0-1.0,
    "per_field": { "field_name": 0.0-1.0 }
  }
}

## Learned Rules
{LEARNED_RULES_INJECTED_HERE}

## OCR Text
{RAW_TEXT_HERE}
```

### Tier 2 Prompt (Claude Sonnet — text re-parse)

Adds escalation context to base prompt:

```
## Previous Extraction Attempt
The following extraction was attempted but failed validation:
{TIER_1_RESULT_JSON}

## Specific Issues Found
{VALIDATION_FAILURES}

Please re-extract with special attention to the flagged issues.
```

### Tier 3 Prompt (Claude Sonnet Vision — image)

```
You are a Thai accounting document parser. Extract structured data from this document image.
You also have the raw OCR text from Google Vision as reference — use it to cross-check
your visual reading.

[...same rules and schema...]

## Google Vision Raw Text (reference)
{RAW_TEXT}

## Previous Extraction Attempts
Tier 1 result: {TIER_1_JSON}
Tier 2 result: {TIER_2_JSON}
Issues: {VALIDATION_FAILURES}
```

### Token Budget Estimates

| Tier | Input | Output | Total | Model |
|---|---|---|---|---|
| 1 | ~2,300 tokens (prompt + rules + raw text) | ~500 | ~2,800 | Haiku |
| 2 | ~3,000 tokens (+ prev result + issues) | ~500 | ~3,500 | Sonnet |
| 3 | ~5,300 tokens (+ image tokens + prev results) | ~500 | ~5,800 | Sonnet |

---

## Learned Rules System

### Database Table

```sql
CREATE TABLE ai_extraction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),          -- NULL = global rule
  rule_type TEXT NOT NULL,                         -- 'issuer_hint', 'field_pattern', 'format_rule'
  trigger_key TEXT NOT NULL,                       -- e.g., 'issuer_tax_id', 'document_type'
  trigger_value TEXT NOT NULL,                     -- e.g., "0145555002610"
  field_name TEXT NOT NULL,                        -- e.g., "invoice_number"
  rule_text TEXT NOT NULL,                         -- natural language rule for prompt injection
  deterministic_value TEXT,                        -- for graduated rules: exact value to apply
  sample_count INTEGER DEFAULT 1,
  confidence NUMERIC(3,2) DEFAULT 0.50,            -- 0.00-1.00
  is_graduated BOOLEAN DEFAULT FALSE,              -- true = skip AI, apply deterministically
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extraction_rules_trigger
  ON ai_extraction_rules(trigger_key, trigger_value)
  WHERE is_graduated = FALSE;

CREATE INDEX idx_extraction_rules_graduated
  ON ai_extraction_rules(trigger_key, trigger_value)
  WHERE is_graduated = TRUE;
```

### Rule Types

| Type | Trigger | Example |
|---|---|---|
| `issuer_hint` | issuer tax_id | "For tax_id 0145555002610 (YJ Service): invoice number format is L{YY}-{MM}-{NNNN}, amounts use comma as thousands and period as decimal" |
| `field_pattern` | document_type | "For RECEIPT type: invoice number is near เลขที่ at top, NOT near รับเงิน section" |
| `format_rule` | global (tenant_id=NULL) | "Date written as D/M/YY on recent documents means Buddhist Era short year, add 2543" |

### Learning Loop

```
User saves corrections on /extractions page
    ↓
Backend diffs original ocrRaw vs corrected values
    ↓
For each changed field:
    → Identify trigger context (issuer_tax_id from extraction)
    → Check ai_extraction_rules for existing matching rule
    ↓
  No existing rule → CREATE
    rule_text generated from correction context
    confidence: 0.50, sample_count: 1
    ↓
  Existing rule → UPDATE
    sample_count += 1
    confidence = min(0.99, confidence + (1 - confidence) * 0.15)
    ↓
  After 10+ consistent samples, confidence > 0.95
    → is_graduated = TRUE
    → Rule applied deterministically without AI call
```

### Rule Application at Extraction Time

1. Extract issuer tax_id from raw text (simple 13-digit regex — only validator regex kept)
2. Load matching rules from DB: `(tenant_id = X OR tenant_id IS NULL) AND (trigger_value matches OR trigger_key = 'global')`
3. Separate graduated rules (deterministic) from prompt rules (injected into Claude prompt)
4. After Claude extraction, overlay graduated rules on result

### Rule Degradation

- User correction contradicts a rule → `confidence -= 0.20` (min 0.10)
- Confidence drops below 0.50 → `is_graduated = FALSE` (back to prompt injection)
- Confidence drops below 0.20 → soft delete rule

---

## Extraction Failure Handling

### Failure Scenarios

| Failure Type | Behavior | User Sees |
|---|---|---|
| Google Vision API fails | Retry 2x with backoff | "OCR Processing" spinner |
| All GV retries fail | Document → QUERY status | Banner: "Extraction failed — enter manually or re-process" |
| Claude API fails (all tiers) | Fall back to raw text + simple validators | Partial extraction, low confidence, user completes |
| Malformed Claude JSON | Retry 1x → escalate to next tier | Transparent to user |
| Corrupted/unreadable file | Document → QUERY with reason | "Could not read this file — check quality and re-upload" |
| Timeout (>30s per tier) | Kill tier, escalate to next | Transparent to user |
| Total pipeline timeout (>60s) | Save best partial result | Partial extraction, user completes |

### Extraction Status

`extraction_status` field on documents table:

| Status | Meaning |
|---|---|
| `pending` | Uploaded, waiting for processing |
| `processing` | Inngest job running |
| `completed` | Extraction succeeded (any tier) |
| `partial` | Some fields extracted, others failed |
| `failed` | All tiers failed, no data extracted |
| `manual` | User chose to enter all fields manually |

### UI for Failed/Partial Extraction

Banner on extraction page when `extraction_status` is `failed` or `partial`:

```
⚠ Extraction incomplete

Some fields could not be extracted automatically.
You can enter the details manually or retry extraction.

[Retry Extraction]  [Enter Manually]
```

- **Retry Extraction** — re-triggers Inngest job, runs full three-tier pipeline
- **Enter Manually** — sets extraction_status = 'manual', all fields editable

---

## Document Editing Workflow

### Status-Based Editing Permissions

| Status | Who Can Edit | Available Actions |
|---|---|---|
| **DRAFT** | Maker, Admin | All fields editable (transient, during OCR) |
| **ACTION_REQUIRED** | Maker, Admin | All fields editable. Save Draft, Submit for Approval |
| **QUERY** | Maker, Admin | All fields editable. Save Draft, Submit for Approval, Retry Extraction, Enter Manually |
| **PENDING_APPROVAL** | Nobody | Read-only. Checker: Approve or Reject |
| **REJECTED** | Maker, Admin | All fields editable. Save Draft, Re-submit for Approval |
| **APPROVED** | Nobody | Read-only. Admin: Create Reversal, Move to Export |
| **EXPORTED** | Nobody | Read-only. Admin: Create Reversal |
| **VOID** | Nobody | Read-only |

### Full User Journey

```
1. UPLOAD
   Maker uploads document → status: DRAFT, extraction_status: pending
   Inngest OCR job triggers automatically

2. EXTRACTION (automatic)
   Google Vision → Claude three-tier pipeline
   Result determines document status:
     → High confidence + balanced JE     → PENDING_APPROVAL
     → Low confidence / unbalanced       → ACTION_REQUIRED
     → Bad quality / failed OCR          → QUERY
     → Extraction failed completely      → QUERY + extraction_status: failed

3. REVIEW & CORRECT (manual)
   Maker opens /extractions?docId=xxx
   Left: document image viewer | Right: extracted fields (editable)

   Actions:
     • Edit any extraction field (including new fields)
     • Edit line items (add/remove/modify rows with discount column)
     • Save Draft (corrections trigger rule learning in background)
     • Submit for Approval (→ PENDING_APPROVAL)
     • Revert changes (undo to last saved state)
     • Retry Extraction (re-run pipeline) — when extraction failed
     • Enter Manually (blank form) — when extraction failed

4. APPROVAL
   Checker reviews in /documents?tab=pending (read-only)
   Approve → APPROVED | Reject (with reason) → REJECTED
   If rejected: back to step 3

5. POST-APPROVAL
   No field editing. Export, Create Reversal, or Void only.
```

---

## Extraction UI Updates

### Changes Visible to Users

1. **New fields** added to existing sections:
   - Document: Reference PO, Credit Due Date
   - Customer: Tax ID
   - Amounts: Discount (between Subtotal and VAT)
   - Line Items table: Discount column (between Unit Price and Total)

2. **Validation indicators** in Amounts section (shown only when failures exist):
   - ✅ Line items check (all lines qty×price-discount=total)
   - ✅ Subtotal check (sum of lines - invoice discount = subtotal)
   - ⚠ VAT check (expected vs actual)
   - ❌ Grand total check (subtotal + VAT ≠ total)

3. **Extraction failure banner** with Retry/Manual buttons (when extraction_status is failed/partial)

4. **Raw OCR JSON removed** from user-facing extraction page

### Debug-Only Information

Tier info, cost, and raw OCR stored in `ocrRaw` JSONB — accessible only via API:

```
GET /api/documents/[id]?include=debug
```

Returns `extraction_debug` object with tier_used, per-tier results, escalation reasons, cost, rules applied. Not rendered in any UI.

---

## File Structure

```
src/lib/services/
  extraction/                          ← NEW directory
    pipeline.ts                        ← Main orchestrator
    tiers/
      tier1-haiku.ts                   ← Google Vision raw text + Claude Haiku
      tier2-sonnet.ts                  ← Claude Sonnet text re-parse
      tier3-vision.ts                  ← Claude Sonnet Vision (image)
    prompts/
      base-extraction.ts               ← Base prompt template
      tier2-escalation.ts              ← Tier 2 prompt with failure context
      tier3-vision.ts                  ← Tier 3 prompt with image
    rules/
      rule-loader.ts                   ← Load learned rules from DB at extraction time
      rule-learner.ts                  ← Detect corrections → create/update rules
      graduated-rules.ts               ← Apply deterministic graduated rules
    validators/
      amount-validator.ts              ← 4-level amount validation
      field-validator.ts               ← Tax ID format, date range, currency
      escalation-check.ts             ← Should we escalate to next tier?
    parsers/
      response-normalizer.ts           ← Normalize Claude JSON → standard schema
      date-parser.ts                   ← Thai BE ↔ CE date conversion
      number-parser.ts                 ← Thai number format handling
    types.ts                           ← Extraction interfaces

  ocr.ts                               ← KEEP: Google Vision raw text call only
                                          REMOVE: regex parsing, field extraction
  confidence.ts                        ← UPDATE: recalibrate for new pipeline
  math-validation.ts                   ← REPLACE with extraction/validators/

src/lib/db/
  schema.ts                            ← ADD: ai_extraction_rules, new document columns
  queries/
    extraction-rules.ts                ← CRUD for learned rules

src/lib/inngest/functions/
  process-document.ts                  ← UPDATE: use new extraction pipeline

src/app/api/documents/[id]/
  route.ts                             ← UPDATE: save corrections → trigger rule learning

src/app/(app)/extractions/
  page.tsx                             ← UPDATE: new fields, validation indicators,
                                          retry/manual buttons, remove raw JSON
```

### Inngest Pipeline (updated)

```
Step 1: "ocr-raw-text"          → Google Vision DOCUMENT_TEXT_DETECTION (unchanged)
Step 2: "extract-structured"    → NEW: extractDocument() three-tier pipeline
Step 3: "classify-document"     → Direction, docType, journalType (mostly unchanged)
Step 4: "generate-journal"      → GL mapping, WHT detection, journal lines (unchanged)
Step 5: "persist-and-finalize"  → Save results + extraction_status + tier info
```

### Migration Plan

| Step | Action | Risk |
|---|---|---|
| 1 | Add new DB columns + ai_extraction_rules table | None — additive |
| 2 | Build extraction/ directory alongside old ocr.ts | None — parallel |
| 3 | Feature flag: `USE_NEW_EXTRACTION_PIPELINE=true` | Safe rollback |
| 4 | New documents use new pipeline, old docs untouched | Gradual rollout |
| 5 | After validation, remove old regex code | Clean up |

### Error Handling

| Failure | Behavior |
|---|---|
| Google Vision API down | Retry 2x with backoff → QUERY status with reason |
| Claude Haiku API down | Skip to Tier 2 (Sonnet) → if also down, partial result with validators only |
| Claude Sonnet API down | Stop at best tier achieved, mark requires_manual_review |
| Malformed Claude JSON | Retry 1x → escalate to next tier |
| Image too large for Vision | Resize to max 4MB before sending |
| Per-tier timeout (>30s) | Kill tier, escalate to next |
| Total pipeline timeout (>60s) | Save best partial result |

---

## Escalation Logic

```typescript
function shouldEscalate(result, validation): boolean {
  // A: weighted confidence < 0.70
  if (result.confidence.weighted < 0.70) return true;

  // B: any critical field confidence < 0.50
  const criticalFields = [
    'issuer_tax_id', 'total_amount', 'vat_amount',
    'invoice_number', 'issue_date'
  ];
  for (const field of criticalFields) {
    if ((result.confidence.per_field[field] ?? 0) < 0.50) return true;
  }

  // C: any amount validation level fails
  if (!validation.lineItemCheck.isValid) return true;
  if (!validation.subtotalCheck.isValid) return true;
  if (!validation.vatCheck.isValid) return true;
  if (!validation.grandTotalCheck.isValid) return true;

  return false;
}
```

---

## Success Criteria

### Extraction Accuracy (must have)

- [ ] Thai Buddhist Era dates correctly converted (short year "24" = 2567 BE = 2024 CE)
- [ ] Number formats parsed correctly (mixed comma/period Thai formats)
- [ ] Invoice number extracted accurately (not grabbing from "INVOICE" header text)
- [ ] VAT amount extracted as actual amount, not percentage label
- [ ] Line items: quantity, unit_price, discount, total correctly assigned per row
- [ ] Fields not misassigned (tax ID never in price field, customer ≠ seller)
- [ ] No early termination on valid documents — all tiers complete extraction

### New Fields (must have)

- [ ] Customer tax_id extracted and saved
- [ ] Invoice-level discount extracted and saved
- [ ] Line item discount column extracted
- [ ] Reference PO extracted (when present)
- [ ] Credit due date extracted or calculated

### Pipeline (must have)

- [ ] Three-tier pipeline operational: Haiku → Sonnet → Sonnet Vision
- [ ] Auto-escalation on: confidence < 0.70, critical field < 0.50, amount validation fail
- [ ] Each tier's result normalized to same schema
- [ ] Feature flag `USE_NEW_EXTRACTION_PIPELINE` for rollback
- [ ] Extraction debug info stored in ocrRaw (not shown in UI)
- [ ] extraction_status tracked per document

### Validation (must have)

- [ ] 4-level amount validation: line item, subtotal, VAT, grand total
- [ ] Validation failures shown in Amounts section on extraction page
- [ ] Validation failures trigger tier escalation

### Learned Rules (must have)

- [ ] User corrections detected on save (diff original vs corrected)
- [ ] Rules created/updated in ai_extraction_rules table
- [ ] Rules injected into extraction prompt for matching issuers
- [ ] Confidence increases with consistent corrections
- [ ] Rules graduate to deterministic at confidence > 0.95 and 10+ samples
- [ ] Graduated rules applied without AI call
- [ ] Contradicting corrections degrade rule confidence

### Failure Handling (must have)

- [ ] Retry Extraction button on extraction page (when failed/partial)
- [ ] Enter Manually option (when failed/partial)
- [ ] Graceful degradation when Claude API is down
- [ ] extraction_failure_reason stored and displayed

### UI (must have)

- [ ] New fields visible and editable on extraction page
- [ ] Line items table includes discount column
- [ ] Validation indicators in Amounts section (when failures exist)
- [ ] Extraction failure banner with Retry/Manual buttons
- [ ] Raw OCR JSON removed from user-facing UI

### Database (must have)

- [ ] ai_extraction_rules table created with indexes
- [ ] documents table: customer_tax_id, reference_po, credit_due_date, discount_amount columns
- [ ] documents table: extraction_status, extraction_failure_reason columns
- [ ] Migration generated via drizzle-kit

### Nice-to-Have (if time permits)

- [ ] Extraction cost tracking per tenant per month (ai_usage table — feeds into Phase 6B)

## Out of Scope

| Item | Deferred To |
|---|---|
| AI provider abstraction layer | Phase 6B |
| COA mapping suggestions | Phase 6C |
| WHT rate suggestions from vendor history | Phase 6C |
| Duplicate document detection (AI-powered) | Phase 6C |
| Smart form defaults | Phase 6C |
| Cmd+K AI chat mode | Phase 6D |
| Cross-tenant anonymized learning | Phase 6D |
| Admin UI for managing extraction rules | Phase 6B |
| AI usage dashboard / credit budgeting | Phase 6B |
| Subscription tier integration | Phase 6B |
| Cash purchase vs credit purchase classification | Future |
| Staff assignment UX rework | Separate UX fix |
| Document deletion flow | Separate UX fix |
| Unbalanced journal entry resolution UX | Separate UX fix |
