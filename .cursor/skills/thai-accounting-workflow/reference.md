# Thai express accounting — extended reference (aicount)

Use with **[SKILL.md](SKILL.md)**. Content below is aligned to the internal blueprint **System Architecture & Workflow: ระบบบัญชีอัตโนมัติ (OCR to GL for Express)** (accounting-firm, multi-tenant, Express handoff). Not legal or tax advice.

## Express program vs full ERP (mental model)

**Express + OCR handoff** optimizes **document → validated posting → approval → export**. **ERP** adds deep operational modules (inventory, manufacturing, advanced projects). Keep aicount aligned with the former unless a task explicitly expands scope.

## Transaction status (blueprint)

Design DB/API/UI so status gates behavior consistently:

| Status | Meaning |
|--------|---------|
| `DRAFT` / `OCR_PROCESSING` | Pipeline running; not ready for approval |
| `ACTION_REQUIRED` | OCR/math/GL failure — maker must fix or route to query |
| `PENDING_APPROVAL` | Ready for checker |
| `REJECTED` | Checker returned with **comment** → back to maker |
| `APPROVED` | Eligible for **period/export** processing; journal considered final for export batch |
| `EXPORTED` | Written to Express file; **no edit/delete** (hard lock per blueprint) |

**Rule:** Only **approved** lines feed **Export to Express** generation; export updates to **exported** + lock.

## Journal routing (สมุดรายวัน) — typical posting shape

Use tenant **COA** codes; Express export carries **journal code** (RV, SV, PV, PurV) on the voucher.

| Journal | Use | Typical pattern (blueprint) |
|---------|-----|-----------------------------|
| **RV** | Receipt / cash sale side | Dr เงินฝาก · Cr รายได้, Cr ภาษีขาย |
| **SV** | Credit sale | Dr ลูกหนี้การค้า · Cr รายได้, Cr ภาษีขาย |
| **PV** | Cash payment | Dr ค่าใช้จ่าย (+ dept), Dr ภาษีซื้อ (if claimable) · Cr เงินฝาก, Cr หัก ณ ที่จ่าย (if any) |
| **PurV** | Credit purchase | Dr ค่าใช้จ่าย/ซื้อ, Dr ภาษีซื้อ · Cr เจ้าหนี้การค้า |
| **JV** | Multi-line / clearing | e.g. petty cash / advance clearance: multiple Dr expenses + VAT, Cr advance/petty cash |

**Credit note:** same journal family as purchase/sale per blueprint with **negative amounts** where applicable.

## Expense classification priority (simplified from blueprint)

After `Direction = EXPENSE`:

1. **Paid (cash):** doc title hints e.g. ใบเสร็จรับเงิน, Receipt, บิลเงินสด → **PV**
2. **Unpaid:** ใบแจ้งหนี้, Invoice, ใบส่งของ (and not a payment receipt) → **PurV**
3. **Pending match:** PO, ใบสั่งซื้อ, ใบเสนอราคา → **no journal** until matched
4. **Credit note:** ใบลดหนี้, Credit Note → PurV with reversed sign

**Revenue direction:** `Issuer_Tax_ID == Tenant_Tax_ID` → revenue branch; then cash vs credit → **RV** vs **SV**.

## VAT / WHT (implementation hints)

- **Input VAT line:** only when tax-invoice conditions met (wording, **13-digit** issuer ID, tenant fields complete). Else **VAT in expense**, **no** Dr ภาษีซื้อ.
- **Stale / disallow flags:** blueprint mentions **date vs current month window** — implement as **configurable rule + UI warning**, not a hard-coded statute.
- **WHT:** keyword heuristics (e.g. ค่าเช่า, ค่าบริการ) + amount thresholds; UI alert for maker; optional **50 ทวิ** PDF generation when Cr หัก ณ ที่จ่าย is posted.

## GL mapping fallback chain

1. **Vendor** match → `Default_Expense_GL` (and default WHT rate if stored)
2. **Product/keyword** table on line text → `Expense_GL` / `Income_GL`
3. Else → **suspense** account; **ACTION_REQUIRED** until maker selects account

**Cross-tenant learning:** optional suggestion layer — **posted account must still belong to that tenant’s COA**.

## Express export structure (voucher)

Per blueprint, each voucher has:

- **Header:** document date (DD/MM/YYYY), **voucher no** (e.g. PV6701-001, auto), **journal code** (PV, PurV, RV, SV), description (vendor / line summary)
- **Detail lines:** `Account_Code`, **`Dept_Code`**, Debit amount, Credit amount, memo; **Σ Dr = Σ Cr** before export allowed

Status after successful write: **`EXPORTED`**; document locked.

## OCR validation (blueprint)

- Extract Tax ID (e.g. `\b\d{13}\b` near เลขประจำตัวผู้เสียภาษี), dates, **Grand Total** (normalize commas).
- **Math check:** Subtotal + VAT ≈ Grand Total within tolerance (e.g. ±0.05) → high confidence UI; else flag maker.

## Master data tables (tenant-scoped)

Minimum entities: `Chart_Of_Accounts`, `Departments`, `Vendors` (Tax ID, default GL, default WHT), `Customers`, `Products` (item code, **keywords**, income/expense GL).

## Development phasing (from blueprint)

1. **MVP:** upload → OCR show fields → **manual** Dr/Cr by maker → export TXT
2. **Rule engine:** auto journal + vendor-based GL mapping
3. **Tax & automation:** WHT alerts, duplicate detection, full multi-tenant hardening

## Filing families (structural)

- **VAT:** PP.30-style periodic summary from **posted** claimable lines
- **WHT:** P.N.D. family summaries from **posted** withholding
- **CIT:** separate accrual/payment journals when in scope

## Data lineage users expect

**Document → voucher lines → Express file → tax report.** Preserve voucher no, doc ref, period, tenant on every hop.

## Common modeling mistakes to avoid

- Exporting **unapproved** or **unbalanced** vouchers
- Posting **PO** to GL before match
- Mixing **WHT payable** with **VAT payable**
- Omitting **department** on lines when Express P&L-by-dept is required
- Allowing edits after **EXPORTED** without an explicit reversal workflow
