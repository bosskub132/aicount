# Implementation Phasing Plan

## Phase 1: Design System + Component Library ✅ COMPLETE (2026-03-23)
- CSS tokens in globals.css (full color, shadow, radius, z-index system)
- 25 components + sidebar + header + 5 document-specific components
- Restyled 3 existing components (workspace-selector, offline-banner, global-search)
- Fonts: Inter + Noto Sans Thai (replaced Geist Sans)

## Phase 2: Core Workflow Pages ✅ COMPLETE (2026-03-23)
- Dashboard: 3-tab (Summary/Pipeline/Action Items) with Recharts charts
- Documents: DataTable + side panel, absorbed Approvals + Query Tray pages
- Extractions: Two-column editing (image viewer + fields)
- Upload: Drag-drop + live OCR status polling
- Export: Template selection + history tab + preview modal
- Security hardening: auth on all endpoints, input validation, tenant scoping

## Phase 3: Accounting Modules ✅ COMPLETE (2026-03-23)
- General Ledger: Two-tab (Journal Entries + Account Ledger), manual JV creation/edit modal
- Accounts Receivable: Aging table by customer, expandable invoice detail, payment recording
- Accounts Payable: Same as AR with WHT deduction in payment modal
- Bank Reconciliation: Split view with auto-matching (amount + date proximity)
- Schema: journalEntries header table, payments, bankTransactions, bankReconMatches

## Phase 4: Reports & Tax ✅ COMPLETE (2026-03-25)

### Phase 4A: Financial Statements (16 tasks)
- 7 reports: Trial Balance, P&L, Balance Sheet, Cash Flow, Monthly Comparison, GL Detail, Journal Listing
- Report Hub card grid + individual sub-pages
- Server-side PDF generation with @react-pdf/renderer → Supabase Storage
- Report history with versioning/locking, retention settings, daily cleanup cron
- Spec: docs/superpowers/specs/2026-03-25-phase4a-financial-statements-design.md

### Phase 4B: Tax Reports (9 tasks)
- 6 reports: ภ.พ.30, ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53, Purchase VAT Register, Sales VAT Register
- Tax Hub + form-matching PDF templates
- Vendor type routing (individual/company/non-resident)
- Schema additions: vendor_type, is_non_resident, branch_number, country, wht fields
- Spec: docs/superpowers/specs/2026-03-25-phase4b-tax-reports-design.md

### Phase 4C: WHT Certificates (11 tasks)
- 50 ทวิ form-matching PDF with void/reissue
- Certificate log + bulk generation
- Atomic sequential numbering
- Spec: docs/superpowers/specs/2026-03-25-phase4c-wht-certificates-design.md

## Phase 5: Settings Polish (partially done)
- Accounting settings stubs need completion (bank-recon, period-locks, templates)
- Master data CRUD pages working (COA, vendors, customers, products, departments)
- Report retention settings page DONE (Phase 4)

## Phase 6: AI Assistant & Suggestion System (spec written, not yet planned)
- AI provider abstraction (Claude default, swappable)
- Inline suggestions + Cmd+K AI chat
- Learning engine + cross-tenant insights
- Privacy controls + cost management

## Future Improvements (deferred from Phase 4)
- ภ.ง.ด.1/1ก — Employee WHT (requires payroll module)
- ภ.ง.ด.54 — WHT for foreign entities
- E-filing integration with rd.go.th
- Email certificates to vendors
- QR code on certificates
- Budget vs Actual report
- Department P&L
- Customer/Vendor statements
