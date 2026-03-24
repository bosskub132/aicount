# Key Files Reference (updated Phase 4)

## Auth & Security
- `src/proxy.ts` — Next.js 16 middleware entry point (NOT middleware.ts)
- `src/lib/supabase/middleware.ts` — Session, email verification, role/tenant headers
- `src/lib/api/request-context.ts` — getRequestContext, ensureTenantScope, ensureRole
- `src/lib/api/csrf.ts` — Origin-based CSRF validation
- `src/lib/api/rate-limit.ts` — Upstash Redis rate limiter with in-process fallback

## Design System
- `src/app/globals.css` — Full design token set
- `src/app/layout.tsx` — Root layout with Inter + Noto Sans Thai + Geist Mono fonts
- `src/components/` — 35+ components (flat structure)
- `src/lib/stores/ui-store.ts` — Zustand: sidebar, toasts, mobile menu + useToast()
- `src/lib/providers/query-provider.tsx` — React Query provider

## App Shell
- `src/app/(app)/layout.tsx` — Sidebar + Header + QueryProvider + auth redirects
- `src/components/sidebar.tsx` — 230px grouped nav (Workflow + Accounting + Reports + Settings)

## Core Pages (Phase 2)
- `src/app/(app)/dashboard/page.tsx` — 3-tab dashboard with Recharts
- `src/app/(app)/documents/page.tsx` — DataTable + side panel
- `src/app/(app)/extractions/page.tsx` — Two-column editing (image + fields)
- `src/app/(app)/upload/page.tsx` — Drag-drop + live OCR status polling
- `src/app/(app)/export/page.tsx` — Template selection + history + preview

## Accounting Pages (Phase 3)
- `src/app/(app)/ledger/page.tsx` — GL with Journal Entries + Account Ledger tabs
- `src/app/(app)/receivables/page.tsx` — AR aging table
- `src/app/(app)/payables/page.tsx` — AP aging table
- `src/app/(app)/bank-recon/page.tsx` — Split view, auto-matching

## Report Pages (Phase 4A)
- `src/app/(app)/reports/financial/page.tsx` — Report Hub (card grid)
- `src/app/(app)/reports/financial/trial-balance/page.tsx`
- `src/app/(app)/reports/financial/profit-loss/page.tsx`
- `src/app/(app)/reports/financial/balance-sheet/page.tsx`
- `src/app/(app)/reports/financial/cash-flow/page.tsx`
- `src/app/(app)/reports/financial/monthly-comparison/page.tsx`
- `src/app/(app)/reports/financial/gl-detail/page.tsx`
- `src/app/(app)/reports/financial/journal-listing/page.tsx`
- `src/app/(app)/settings/accounting/report-retention/page.tsx`

## Tax Report Pages (Phase 4B)
- `src/app/(app)/reports/tax/page.tsx` — Tax Report Hub
- `src/app/(app)/reports/tax/pp30/page.tsx` — ภ.พ.30
- `src/app/(app)/reports/tax/pp36/page.tsx` — ภ.พ.36
- `src/app/(app)/reports/tax/pnd3/page.tsx` — ภ.ง.ด.3
- `src/app/(app)/reports/tax/pnd53/page.tsx` — ภ.ง.ด.53
- `src/app/(app)/reports/tax/purchase-vat/page.tsx`
- `src/app/(app)/reports/tax/sales-vat/page.tsx`

## WHT Certificates (Phase 4C)
- `src/app/(app)/reports/wht/page.tsx` — Certificate Log + Bulk Generate

## Report Infrastructure (Phase 4)
- `src/lib/services/report-generator.ts` — Orchestrator: data → PDF → Storage → history
- `src/lib/services/report-pdf-templates.ts` — 7 financial report PDF templates
- `src/lib/services/report-retention.ts` — Expiry computation, validation
- `src/lib/services/tax-pdf-templates.ts` — 6 tax report PDF templates
- `src/lib/services/wht-certificate.ts` — Certificate generation + void orchestrator
- `src/lib/services/wht-certificate-pdf.ts` — 50 ทวิ PDF template
- `src/lib/services/wht-certificate-number.ts` — Atomic sequential numbering
- `src/lib/services/wht-form-routing.ts` — PND3/PND53/PP36 routing + income type codes

## Report Queries (Phase 4)
- `src/lib/db/queries/period-utils.ts` — Shared period resolution (M/Q/Y/custom)
- `src/lib/db/queries/profit-loss.ts` — P&L aggregation
- `src/lib/db/queries/balance-sheet.ts` — Cumulative BS with retained earnings
- `src/lib/db/queries/cash-flow.ts` — Indirect method with cashFlowCategory
- `src/lib/db/queries/journal-listing.ts` — Paginated JV listing
- `src/lib/db/queries/report-history.ts` — History CRUD with UPSERT draft
- `src/lib/db/queries/report-retention.ts` — Retention policy CRUD
- `src/lib/db/queries/tax-pp30.ts` — VAT return
- `src/lib/db/queries/tax-pp36.ts` — Non-resident services
- `src/lib/db/queries/tax-pnd3.ts` — Individual WHT
- `src/lib/db/queries/tax-pnd53.ts` — Corporate WHT (with unmatched)
- `src/lib/db/queries/vat-register.ts` — Purchase/Sales VAT register
- `src/lib/db/queries/wht-certificates.ts` — Certificate CRUD

## Report Hooks (Phase 4)
- `src/lib/hooks/use-trial-balance.ts` through `use-journal-listing.ts` (7 hooks)
- `src/lib/hooks/use-report-history.ts` — List + lock/unlock/delete/restore mutations
- `src/lib/hooks/use-report-pdf.ts` — Generate PDF mutation
- `src/lib/hooks/use-report-retention.ts` — Settings CRUD
- `src/lib/hooks/use-tax-pp30.ts` through `use-vat-register.ts` (5 hooks)
- `src/lib/hooks/use-wht-certificates.ts` — List + generate/void/batch mutations
- `src/lib/hooks/use-wht-uncertified.ts` — Uncertified documents

## Report Components (Phase 4)
- `src/components/period-picker.tsx` — M/Q/Y toggle + navigator
- `src/components/report-filter-bar.tsx` — Configurable filter bar
- `src/components/report-stat-cards.tsx` — 4-card grid with colored borders
- `src/components/pdf-preview-modal.tsx` — PDF iframe viewer
- `src/components/report-history-drawer.tsx` — Side drawer for past generations

## Background Jobs
- `src/lib/inngest/functions/report-cleanup.ts` — Daily cron: expire reports + WHT certs
- `src/lib/inngest/functions/wht-batch-generate.ts` — Bulk certificate generation

## Specs & Plans
- `docs/superpowers/specs/2026-03-25-phase4a-financial-statements-design.md`
- `docs/superpowers/specs/2026-03-25-phase4b-tax-reports-design.md`
- `docs/superpowers/specs/2026-03-25-phase4c-wht-certificates-design.md`
- `docs/superpowers/plans/2026-03-25-phase4a-financial-statements.md`
- `docs/superpowers/plans/2026-03-25-phase4b-tax-reports.md`
- `docs/superpowers/plans/2026-03-25-phase4c-wht-certificates.md`
