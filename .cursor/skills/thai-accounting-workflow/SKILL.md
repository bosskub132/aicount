---
name: thai-accounting-workflow
description: >-
  Thai accounting-firm OCR-to-GL pipeline for Express: multi-tenant master
  data, pre-process/OCR/classify/tax/GL map, RV/SV/PV/PurV routing,
  maker-checker states, period tasks, and Text/CSV export. Use when
  implementing or reviewing aicount against real express handoff and Thai
  VAT/WHT rules — aligns to the OCR → GL for Express blueprint.
---

# Thai express accounting workflow (aicount)

Treat **aicount** as an **express accounting–class** product aimed at **สำนักงานบัญชี (accounting firms)**: **one client company = one workspace/tenant** with **isolated** master data and transactions. The target path is **image/PDF → OCR → classification & validation → tax (VAT/WHT) → GL mapping → journal (สมุดรายวัน) → maker/checker → period tasks → export to Express** (`.txt` / CSV). Full ERP depth (inventory costing, manufacturing, multi-currency treasury, etc.) is **out of scope** unless the task explicitly adds it.

**Product blueprint:** internal spec *System Architecture & Workflow: ระบบบัญชีอัตโนมัติ (OCR to GL for Express)* — use it as the canonical workflow when building or reviewing OCR, mapping, statuses, and export behavior.

## When to use this skill

**Read this skill before implementing or reviewing** anything that affects:

- How money or tax is recorded, summarized, or exported
- Periods, locks, approvals, or audit trails for books
- Document → journal → ledger → trial balance → reports
- VAT, withholding, fixed assets, payroll accruals, or bank reconciliation
- **OCR pipeline**: pre-process, extraction, validation vs master data, classification, GL mapping, suspense/query trays
- **Express paths**: voucher numbering, journal codes (RV/SV/PV/PurV), dept/cost center on lines, Text/CSV export, post-export lock

If the change is purely technical (CSS, unrelated refactors), skip it.

## What an express accounting program should cover (capability bar)

Design and review against this bar; label gaps honestly in UX if the app defers a lane.

| Lane | Express expectation |
|------|---------------------|
| **Ingest** | Upload **image/PDF**; **pre-process** (page split/merge, grouping e.g. same Tax ID + month for batch review); OCR fields (Tax ID, date, amounts); **confidence** from math checks (e.g. subtotal + VAT ≈ grand total within tolerance). |
| **Master data** | Per-tenant **COA** (codes differ per company), **vendors/customers/products** (product **keywords** for line matching), **departments/cost centers** — Express uses dept for **P&L by department** on export. |
| **Books** | Route to the correct **สมุดรายวัน**: **RV** (รับ), **SV** (ขาย), **PV** (จ่าย), **PurV** (ซื้อ), plus **JV** when the blueprint calls for multi-line clearing (e.g. petty cash / advance clearance). **Double-entry**; PO/quote-style docs stay **reference / pending match — no GL** until matched. |
| **Controls** | **Maker / checker** (or equivalent) where policy requires; reject/return with reason; immutable or audited changes after post where the app promises that. |
| **Periods** | Posting date respects **open period**; **lock** blocks casual edits; reopen/adjust is exceptional and traceable. |
| **Tax (Thailand)** | VAT and WHT reflected in postings and summaries used for filing **support** — totals trace to posted lines and documents, not orphan widgets. |
| **Cash/bank** | At minimum, clear cash/bank movement vs GL; **reconciliation** UX when the product claims it (exceptions, uncleared items). |
| **Close** | Lightweight checklist mindset: reconcile → review tax position → lock → reports; not necessarily a heavy ERP close console unless built. |
| **Handoff** | **Express Text/CSV**: header (date, voucher no, journal code, description) + detail lines (account, **dept**, Dr/Cr); export only **approved** rows; balance Dr/Cr before allow export; **exported** → lock against edit/delete per blueprint. Tax reports (e.g. ซื้อ-ขาย / PP.30-style, ภ.ง.ด. summaries) as separate outputs from posted data. |

## Blueprint alignment: OCR → GL → Express (canonical pipeline)

Use this ordering when designing APIs, DB states, and UI stages:

1. **Workspace** — user selects **client company (tenant)**; all master data and transactions scoped to that tenant.
2. **Pre-process** — split/merge pages into one logical transaction where needed; optional **grouping** (e.g. same Tax ID + month) for review efficiency.
3. **OCR & extract** — Tax ID (e.g. 13 digits), dates, totals; **validate** against master data where applicable.
4. **Classify** — direction: **issuer Tax ID = tenant Tax ID → revenue**; else **expense**. Sub-types: cash vs credit sale; cash vs credit purchase; petty cash / deposit / PO; **credit note** may post as reversed amounts to the appropriate journal.
5. **Tax** — **VAT**: if valid tax invoice + valid counterparty Tax ID + required fields → separate **input VAT**; else treat VAT as **part of expense** (no input VAT line). **WHT**: keyword/rate logic (e.g. services/rent patterns); support **50 ทวิ** certificate output when the product promises it. **Stale invoice rule** (e.g. date vs current month window) → treat as non-claimable / flagged per policy — encode as **structure + flags**, not unverifiable legal constants.
6. **GL mapping** — fallback chain: **vendor default GL** → **product/keyword** table → **suspense (รอตรวจสอบ)** forcing maker action. **Learning/suggestions** after checker confirm is optional; **cross-tenant AI suggestions** are a documented advanced pattern — still store resolved mappings **per tenant** for COA correctness.
7. **Journal routing** — assign **RV / SV / PV / PurV / JV** per blueprint (paid cash bill → PV; unpaid invoice → PurV; etc.).
8. **Maker → Checker** — maker fixes OCR/GL; checker approves or **rejects with comment**; **only approved** entries feed period jobs and Express export.
9. **Time-based** — **daily**: bank reconciliation; **monthly**: tax summaries, prepayments, **lock period**; **yearly**: depreciation, closing entries — only where implemented.
10. **Export** — generate Express-compatible file; mark **exported** and **lock** source transactions as specified.

**Exception paths (blueprint):** unreadable OCR / invalid math / missing buyer on cash bill → **action required** or **query to client** (notifications); do not silently post.

## End-to-end process (Thai practice, express ordering)

Order matches how users actually run an express product day to day; deeper ERP steps appear only if implemented.

1. **Master data and policy**
   - Chart of accounts aligned to operations and (where used) Thai presentation norms; optional dimensions (department, project) **only if** the product supports them end-to-end.
   - Tax registration context: VAT registrant or not, WHT obligations, fiscal year, functional currency (usually THB for domestic books).

2. **Source documents (fast path + OCR)**
   - Purchase/sale: tax invoice, receipt, credit/debit note; **PO/ใบเสนอราคา** as **pending reference** (no GL) until matched.
   - Petty cash / advance **clearing**: multi-line Dr expenses + VAT / Cr advance or petty cash — often **JV** or **PV** per firm policy.
   - Other: payment vouchers, bank statements.
   - **Control**: pipeline **status** (see reference) through **maker → checker**; attachments and audit trail.

3. **Recording (books)**
   - Post to **general ledger** via journals; sub-ledgers (AP, AR, cash/bank, fixed assets, payroll) when modeled — balances roll up to control accounts.
   - **Cut-off**: transactions land in the correct **period**; late documents surface a choice (current vs adjustment) per policy, not silent reassignment.

4. **Tax logic in the books (Thailand)**
   - **VAT**: **ใบกำกับภาษี** + valid **13-digit** Tax ID checks; claimable vs **VAT embedded in expense** for cash/invalid cases; **PP.30-style** summaries from **posted** lines.
   - **WHT**: withheld amounts, **payable to Revenue Department**, **ภ.ง.ด. 3/53** style summaries; **50 ทวิ** when product supports — separate from VAT buckets.
   - **Corporate income tax**: accrual/payment journals when in scope; otherwise do not imply full CIT automation.

5. **Bank and cash**
   - **Reconciliation** when promised: cleared vs book, fees, exceptions — avoid empty “everything matched” without handling differences.

6. **Payroll and fixed assets**
   - Include only if the product ships those modules; otherwise **empty states** should not pretend full payroll/FA compliance.

7. **Period close (express)**
   - Typical sequence: finish postings for period → bank/cash sanity → VAT/WHT position review → **lock** → TB / GL export for accountant.
   - Reopen/adjust closed periods: **rare**, gated, audited — never silent.

8. **Reporting, exports, integrations**
   - **Express voucher file**: journal code, auto voucher numbering, **department on each detail line**, balanced Dr/Cr; include only **approved** (pre-export) data; after export, **immutable** per blueprint.
   - TB, GL detail, tax reports where implemented; honest errors (period lock, unbalanced voucher, wrong tenant).
   - Channels (e.g. messaging, webhooks): **query/notify client** for bad scans; operational handoff, not a substitute for posted books unless designed that way.

## Alignment checklist (apply to each task)

Use this before shipping accounting-related behavior:

- [ ] **Express fit**: The flow favors **few steps** from document to posted books without dropping controls (status, approval, period) the product claims.
- [ ] **Blueprint parity**: OCR → classify → tax → GL map → journal type → maker/checker → export matches the **OCR to GL for Express** stages; **PO = no GL** until match; **suspense** when mapping unknown.
- [ ] **Transaction status**: States are consistent end-to-end (OCR processing, action required, pending approval, rejected, approved, exported) and **gates** export and immutability correctly.
- [ ] **Document → entry**: Every automated posting traceable to a source document or an explicit manual journal with reason.
- [ ] **Double-entry**: Debits equal credits; no orphan lines; correct control vs detail accounts when sub-ledgers exist.
- [ ] **Period discipline**: Dates and period locks respected; errors explain *which* period or policy blocks the action.
- [ ] **Tax separation**: VAT and WHT amounts and bases distinguishable from revenue/expense **net** positions where the workflow requires filing support.
- [ ] **Tenant and role reality**: Maker/checker and approvals match how Thai firms segregate duties when the product models them.
- [ ] **Exports / handoff**: Outputs match **declared scope** (columns, date/period filters, file type); failures mention locks, range, or permissions — not generic errors.
- [ ] **Honest states**: Loading/empty/error copy reflects accounting outcomes (reject, lock, mismatch) — see workspace product-and-ui standards.

## Domain language (prefer for user-facing copy)

Use terms Thai accountants recognize: ใบกำกับภาษี (tax invoice), ภาษีซื้อ/ภาษีขาย (input/output VAT), หัก ณ ที่จ่าย (withholding), งบทดลอง (trial balance), รอบบัญชี (accounting period), ปิดบัญชี (period close / year-end close in context), สมุดรายวัน (journal), แยกประเภท (subsidiary ledger / GL sub-detail). Prefer Thai labels when the app is Thai-first; keep internal code identifiers in English if that is the repo convention.

## Explicit non-goals / caveats

- **Not full ERP by default**: Express products omit or simplify inventory valuation, project costing, treasury workstations, etc. Do not imply those unless the codebase actually implements them.
- **Rates, thresholds, form numbers, and filing deadlines** change with law and entity type. Encode **structure** (VAT registrant flag, WHT on payment, period) and **placeholders** for advisor-confirmed rates; do not hard-code legal advice as eternal truth without comments and update paths.
- **Tax book vs financial book**: Some entities maintain differences (e.g. depreciation). If the product supports only one ledger, state that limitation in UX or docs rather than implying full tax deferral tracking unless implemented.

## Pair with other aicount skills

- **[aicount-backend-api](../aicount-backend-api/SKILL.md)**: tenant-scoped APIs, validation, JSON contracts.
- **[aicount-frontend-ui](../aicount-frontend-ui/SKILL.md)**: client fetch patterns, B2B accounting UX.

## Deeper reference (optional)

For **transaction status enum**, **journal Dr/Cr patterns**, **classification priority**, **Express column layout**, and filing lineage, see **[reference.md](reference.md)** — keep `SKILL.md` the default read.
