# Key Files Reference (updated Phase 3)

## Auth & Security
- `src/proxy.ts` — Next.js 16 middleware entry point (NOT middleware.ts)
- `src/lib/supabase/middleware.ts` — Session, email verification, role/tenant headers
- `src/lib/api/request-context.ts` — getRequestContext, ensureTenantScope, ensureRole
- `src/lib/api/csrf.ts` — Origin-based CSRF validation
- `src/lib/api/rate-limit.ts` — Upstash Redis rate limiter with in-process fallback

## Design System
- `src/app/globals.css` — Full design token set (colors, shadows, radius, z-index, badge colors, aging colors)
- `src/app/layout.tsx` — Root layout with Inter + Noto Sans Thai + Geist Mono fonts
- `src/components/` — 30+ components (flat structure)
- `src/lib/stores/ui-store.ts` — Zustand: sidebar, toasts, mobile menu + useToast()
- `src/lib/providers/query-provider.tsx` — React Query provider

## App Shell
- `src/app/(app)/layout.tsx` — Sidebar + Header + QueryProvider + auth redirects + deletion banner
- `src/components/sidebar.tsx` — 230px grouped nav (Workflow + Accounting + Settings)
- `src/components/header.tsx` — 56px sticky, search trigger, avatar

## Core Pages (Phase 2)
- `src/app/(app)/dashboard/page.tsx` — 3-tab dashboard with Recharts
- `src/app/(app)/documents/page.tsx` — DataTable + side panel + tabs + pagination
- `src/app/(app)/extractions/page.tsx` — Two-column editing (image + fields)
- `src/app/(app)/upload/page.tsx` — Drag-drop + live OCR status polling
- `src/app/(app)/export/page.tsx` — Template selection + history + preview modal

## Accounting Pages (Phase 3)
- `src/app/(app)/ledger/page.tsx` — GL with Journal Entries + Account Ledger tabs, JV modal
- `src/app/(app)/receivables/page.tsx` — AR aging table, customer drill-down, payment recording
- `src/app/(app)/payables/page.tsx` — AP aging table, vendor drill-down, WHT in payments
- `src/app/(app)/bank-recon/page.tsx` — Split view, auto-matching, confirm/unmatch

## Accounting Components (Phase 3)
- `src/components/currency-input.tsx` — ฿ prefix, thousand separators, tabular-nums
- `src/components/account-select.tsx` — Searchable COA dropdown grouped by category
- `src/components/journal-line-editor.tsx` — Editable JV lines with balance check
- `src/components/aging-mini-bar.tsx` — Horizontal stacked aging bar
- `src/components/data-table.tsx` — Enhanced with expandedRow render prop

## React Query Hooks
- `src/lib/hooks/use-documents.ts` — useDocuments, useDocument, useDocumentMutations
- `src/lib/hooks/use-dashboard.ts` — useMonthlyComparison, useStatusBreakdown, useApprovalQueue
- `src/lib/hooks/use-export.ts` — useExportTemplates, useExportHistory, useExportMutation
- `src/lib/hooks/use-journal-entries.ts` — useJournalEntries, useCreateJournalEntry, usePostJournalEntry
- `src/lib/hooks/use-account-ledger.ts` — useAccountLedger
- `src/lib/hooks/use-receivables.ts` — useReceivables
- `src/lib/hooks/use-payables.ts` — usePayables
- `src/lib/hooks/use-payments.ts` — useRecordPayment
- `src/lib/hooks/use-bank-recon.ts` — useBankRecon, useConfirmMatch, useBulkConfirm

## Services (Phase 3)
- `src/lib/services/jv-number.ts` — Tenant-scoped JV number generation (JV-YYYY-NNNN)
- `src/lib/services/payment-status.ts` — Compute open/partial/paid/overdue
- `src/lib/services/aging.ts` — Overdue-based aging bucket calculation
- `src/lib/services/bank-matching.ts` — Auto-match bank txns to GL entries
- `src/lib/utils/csv-export.ts` — Client-side CSV with UTF-8 BOM for Thai

## DB Queries (Phase 3)
- `src/lib/db/queries/journal-entries.ts` — CRUD, list, post, reverse, stats
- `src/lib/db/queries/account-ledger.ts` — Running balance, opening/closing
- `src/lib/db/queries/receivables.ts` — AR aging by customer
- `src/lib/db/queries/payables.ts` — AP aging by vendor
- `src/lib/db/queries/payments.ts` — Record payment + offsetting JE
- `src/lib/db/queries/bank-recon.ts` — Match/unmatch/confirm

## API Routes (Phase 3)
- `GET/POST /api/tenants/{id}/journal-entries` — List + create
- `GET/PUT/PATCH /api/tenants/{id}/journal-entries/{entryId}` — Single + edit + status
- `GET /api/tenants/{id}/account-ledger` — Account transactions
- `GET /api/tenants/{id}/receivables` — AR aging
- `GET /api/tenants/{id}/payables` — AP aging
- `POST /api/tenants/{id}/payments` — Record payment
- `GET /api/tenants/{id}/bank-recon` — Bank recon data
- `POST/DELETE /api/tenants/{id}/bank-recon/matches` — Confirm/unmatch

## Specs & Plans
- `docs/superpowers/specs/2026-03-23-phase3-accounting-modules-design.md`
- `docs/superpowers/plans/2026-03-23-phase3-accounting-modules.md`
- `docs/superpowers/specs/2026-03-23-phase2-core-workflows-design.md`
- `docs/superpowers/plans/2026-03-23-phase2-core-workflows.md`
- `docs/superpowers/plans/2026-03-22-design-system-phase1.md`
