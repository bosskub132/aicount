# Implementation Phasing Plan

## Phase 1: Design System + Component Library ✅ COMPLETE (2026-03-23)
- CSS tokens in globals.css (full color, shadow, radius, z-index system)
- 25 components + sidebar + header + 5 document-specific components
- Restyled 3 existing components (workspace-selector, offline-banner, global-search)
- Fonts: Inter + Noto Sans Thai (replaced Geist Sans)
- Plan: docs/superpowers/plans/2026-03-22-design-system-phase1.md

## Phase 2: Core Workflow Pages ✅ COMPLETE (2026-03-23)
- Dashboard: 3-tab (Summary/Pipeline/Action Items) with Recharts charts
- Documents: DataTable + side panel, absorbed Approvals + Query Tray pages
- Extractions: Two-column editing (image viewer + fields)
- Upload: Drag-drop + live OCR status polling
- Export: Template selection + history tab + preview modal
- React Query hooks for all data fetching
- 3 API additions: pagination, status-breakdown, export-history enhancement
- Security hardening: auth on all endpoints, input validation, tenant scoping
- Spec: docs/superpowers/specs/2026-03-23-phase2-core-workflows-design.md
- Plan: docs/superpowers/plans/2026-03-23-phase2-core-workflows.md

## Phase 3: Accounting Modules ✅ COMPLETE (2026-03-23)
- General Ledger: Two-tab (Journal Entries + Account Ledger), manual JV creation/edit modal
- Accounts Receivable: Aging table by customer, expandable invoice detail, payment recording
- Accounts Payable: Same as AR with WHT deduction in payment modal
- Bank Reconciliation: Split view with auto-matching (amount + date proximity)
- Schema: journalEntries header table, payments, bankTransactions, bankReconMatches
- 4 new shared components: CurrencyInput, AccountSelect, JournalLineEditor, AgingMiniBar
- DataTable enhanced with expandedRow render prop
- 6 new API routes, 6 React Query hooks, 4 service modules, 6 query modules
- Migration NOT yet applied (tables defined in schema.ts, SQL not generated)
- Spec: docs/superpowers/specs/2026-03-23-phase3-accounting-modules-design.md
- Plan: docs/superpowers/plans/2026-03-23-phase3-accounting-modules.md
- Mockups: .superpowers/brainstorm/45399-1774208299/ (gl-ledger-v2.html, ar-receivables-v2.html)

## Phase 4: Reports & Tax (not yet specced)
- Financial Statements (Balance Sheet, P&L, Cash Flow, Trial Balance)
- Tax Reports (ภ.พ.30, ภ.พ.36, ภ.ง.ด. series)
- WHT Certificates (50 ทวิ)
- Report APIs already exist (trial-balance, aging, monthly-comparison, vendor-summary)

## Phase 5: Settings Polish (partially done)
- Accounting settings stubs need completion (bank-recon, period-locks, tax-reports, templates)
- Master data CRUD pages working (COA, vendors, customers, products, departments)

## Phase 6: AI Assistant & Suggestion System (spec written, not yet planned)
- AI provider abstraction (Claude default, swappable)
- Inline suggestions + Cmd+K AI chat
- Learning engine + cross-tenant insights
- Privacy controls + cost management
