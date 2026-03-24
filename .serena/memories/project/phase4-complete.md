# Phase 4: Reports & Tax — COMPLETE (2026-03-25)

## Summary
Phase 4 added 13 reports, WHT certificates, and supporting infrastructure across 3 sub-phases.
107 files changed, ~25,300 lines added. All lint-clean and build-clean on feature/app-v2.

## Phase 4A: Financial Statements (16 tasks)
- **7 reports**: Trial Balance, P&L, Balance Sheet, Cash Flow, Monthly Comparison, GL Detail, Journal Listing
- **Report Hub**: `/reports/financial` card grid → 7 sub-pages
- **PDF generation**: Server-side @react-pdf/renderer → Supabase Storage (bucket: report-pdfs)
- **Report history**: `report_history` table with versioning (one draft per type+period), lock/unlock, soft delete
- **Retention settings**: `/settings/accounting/report-retention` with tiered policy (financial 7yr, tax 7yr, management 2yr, drafts 30d), confirmation dialog, lifecycle
- **Cleanup cron**: Daily Inngest job at 02:00 ICT, batch 100, per-tenant trash recovery
- **Critical fix**: Trial balance query now joins journalLines → journalEntries (not documents) to include manual JVs
- **Balance sheet**: Includes retained earnings (cumulative net income) in equity section

## Phase 4B: Tax Reports (9 tasks)
- **6 reports**: ภ.พ.30, ภ.พ.36, ภ.ง.ด.3, ภ.ง.ด.53, Purchase VAT Register, Sales VAT Register
- **Tax Hub**: `/reports/tax` card grid → 6 sub-pages
- **Schema additions**: vendors (vendor_type, is_non_resident, branch_number, country), customers (branch_number), documents (issuer_branch, wht_income_type, wht_rate)
- **WHT form routing**: getWhtFormType() auto-routes to PND3/PND53/PP36 based on vendor_type + is_non_resident
- **Income type codes**: PND3 uses Section 40(1)-(8), PND53 uses corporate types 1-8
- **Unmatched vendors**: Default to PND53 with warning section
- **VAT registers**: Purchase joins vendors, Sales joins customers, branch resolution with COALESCE fallback
- **Deprecated**: Old /tax-report/pp30 and /tax-report/pnd353 routes (comments added)

## Phase 4C: WHT Certificates (11 tasks)
- **50 ทวิ PDF**: Form-matching layout replicating official RD form (payer/payee boxes, income type checkboxes, signature area)
- **Certificate log**: `/reports/wht` with Certificate Log + Bulk Generate tabs
- **Numbering**: Atomic sequential WHT-YYYY-NNNN via tenants.nextWhtSequence (same pattern as JV numbering)
- **Bulk generation**: Sync for ≤10 docs, Inngest job for >10
- **Void/reissue**: Voided cert gets "เป็นโมฆะ" watermark, document becomes re-certifiable, replaces_id audit trail
- **Tenant profile**: Added address + branch_number to tenants table (required for official forms)
- **Legacy removed**: generate50TawiFile() text generator replaced by proper PDF orchestrator
- **Cleanup cron extended**: Now also processes wht_certificates table

## New Tables (4 migrations)
- `report_history` — report versioning with lock/soft delete/expiry
- `report_retention_policy` — per-tenant tiered retention config
- `wht_certificates` — individual certificate records with snapshot data
- New columns on: tenants (address, branchNumber, nextWhtSequence), vendors (4 fields), customers (1 field), documents (3 fields), chart_of_accounts (cashFlowCategory)

## Key Architecture Decisions
- All financial queries join journalLines → journalEntries (NOT documents) for tenant scoping
- Only POSTED journal entries included in reports
- PDF storage in Supabase Storage with signed URLs (1hr expiry)
- Certificate data snapshotted at generation time (immutable legal documents)
- Report history uses UPSERT with partial unique index for draft versioning
- Retention policy recalculated on policy change (affects existing reports)

## Specs & Plans
- Specs: docs/superpowers/specs/2026-03-25-phase4{a,b,c}-*-design.md
- Plans: docs/superpowers/plans/2026-03-25-phase4{a,b,c}-*.md
