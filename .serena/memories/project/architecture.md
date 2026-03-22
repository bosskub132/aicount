# AICount - Project Architecture (updated Phase 3)

## Overview
Thai accounting SaaS: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL via Drizzle ORM).

## Key Directories
- `src/app/(app)/` — Authenticated pages (dashboard, upload, documents, extractions, export, settings, ledger, receivables, payables, bank-recon)
- `src/app/(auth)/` — Auth pages (login, signup, invite)
- `src/app/api/` — API route handlers
- `src/components/` — 30+ design system components (flat, no ui/ subfolder)
- `src/lib/hooks/` — React Query hooks (use-documents, use-dashboard, use-export, use-journal-entries, use-account-ledger, use-receivables, use-payables, use-payments, use-bank-recon)
- `src/lib/providers/` — QueryClientProvider wrapper
- `src/lib/stores/` — Zustand stores (ui-store: sidebar, toasts, mobile menu)
- `src/lib/services/` — Business logic (OCR, confidence, VAT, WHT, audit, jv-number, payment-status, aging, bank-matching)
- `src/lib/api/` — Auth (request-context, csrf, rate-limit)
- `src/lib/db/` — Drizzle schema, relations, queries (journal-entries, account-ledger, receivables, payables, payments, bank-recon)
- `src/lib/utils/` — Constants, formatters, csv-export
- `src/lib/inngest/` — Background job definitions

## IMPORTANT: Next.js 16 Middleware
- Uses `src/proxy.ts` (NOT middleware.ts) — Next.js 16 convention
- Do NOT create middleware.ts — it will conflict with proxy.ts
- Auth middleware: `src/lib/supabase/middleware.ts` (called by proxy.ts)

## Auth Pattern (all API routes)
```tsx
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";
const ctx = getRequestContext(request);
if (!ctx) return unauthorized();
if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant");
```
- Auth uses custom headers (x-user-id, x-tenant-id, x-user-role) set by proxy.ts
- Users link to tenants via `tenant_assignments` table
- Testing locally: `curl -H "x-user-id: UUID" -H "x-tenant-id: UUID" -H "x-user-role: admin" http://localhost:3000/api/...`

## React Compiler
- Active and strict — avoid `Date.now()` / `Math.random()` in render
- Wrap cascading `setState` in `startTransition`
- Stabilize useMemo/useCallback deps (wrap logical expressions in their own useMemo)

## Data Fetching
- React Query v5 via hooks in `src/lib/hooks/`
- QueryClientProvider in `src/app/(app)/layout.tsx`
- Toast notifications via `useToast()` from `src/lib/stores/ui-store`

## Schema (Phase 3 additions)
- `journalEntries` — header table grouping journalLines (JV number, status, type)
- `journalLines.documentId` — nullable (manual JVs have no source document)
- `journalLines.journalEntryId` — FK to journalEntries header
- `payments` — tracks AR/AP payments against documents, includes WHT deduction
- `bankTransactions` + `bankReconMatches` — bank reconciliation
- Direction enum: `"REVENUE"` = AR, `"EXPENSE"` = AP
- Migration NOT yet applied — run `npx drizzle-kit generate` then `npx drizzle-kit push`

## Styling
- Tailwind CSS v4 with @theme inline in globals.css
- Full CSS variable system (colors, shadows, radius, z-index, badge colors, aging colors)
- Fonts: Inter + Noto Sans Thai + Geist Mono
- Icons: lucide-react only
