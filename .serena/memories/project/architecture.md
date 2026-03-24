# AICount - Project Architecture (updated Phase 4)

## Overview
Thai accounting SaaS: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL via Drizzle ORM).

## Key Directories
- `src/app/(app)/` — Authenticated pages (dashboard, upload, documents, extractions, export, settings, ledger, receivables, payables, bank-recon, reports/financial, reports/tax, reports/wht)
- `src/app/(auth)/` — Auth pages (login, signup, invite)
- `src/app/api/` — API route handlers
- `src/components/` — 35+ design system components (flat, no ui/ subfolder)
- `src/lib/hooks/` — 25+ React Query hooks
- `src/lib/providers/` — QueryClientProvider wrapper
- `src/lib/stores/` — Zustand stores (ui-store: sidebar, toasts, mobile menu)
- `src/lib/services/` — Business logic (OCR, confidence, VAT, WHT, audit, reports, certificates)
- `src/lib/api/` — Auth (request-context, csrf, rate-limit)
- `src/lib/db/` — Drizzle schema, relations, 20+ query modules
- `src/lib/utils/` — Constants, formatters, csv-export
- `src/lib/inngest/` — Background job definitions (OCR processing, report cleanup, WHT batch)

## IMPORTANT: Next.js 16 Middleware
- Uses `src/proxy.ts` (NOT middleware.ts)
- Auth middleware: `src/lib/supabase/middleware.ts` (called by proxy.ts)

## Auth Pattern (all API routes)
```tsx
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";
const ctx = getRequestContext(request);
if (!ctx) return unauthorized();
if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant");
```

## React Compiler
Active and strict — avoid Date.now()/Math.random() in render, wrap cascading setState in startTransition, stabilize useMemo deps.

## Schema (Phase 4 additions)
- `reportHistory` — report versioning with lock/soft delete/expiry, partial unique index for draft UPSERT
- `reportRetentionPolicy` — per-tenant tiered retention config (financial/tax/wht/management)
- `whtCertificates` — individual certificate records with snapshotted payer/payee data, void support
- `chartOfAccounts.cashFlowCategory` — operating/investing/financing classification
- `tenants` additions: address, branchNumber, nextWhtSequence
- `vendors` additions: vendorType (individual/company), isNonResident, branchNumber, country
- `customers` additions: branchNumber
- `documents` additions: issuerBranch, whtIncomeType, whtRate

## Critical Query Pattern
ALL financial report queries MUST join journalLines → journalEntries (NOT documents) for tenant scoping. The documents join silently excludes manual journal entries.

## PDF Generation
- Server-side @react-pdf/renderer with renderToBuffer()
- Uploaded to Supabase Storage (bucket: report-pdfs, wht-certificates)
- Signed URLs with 1-hour expiry for download
- NotoSansThai font registered for Thai text
- Templates in report-pdf-templates.ts, tax-pdf-templates.ts, wht-certificate-pdf.ts

## Report History & Retention
- Auto-save with versioning: one active draft per type+period (UPSERT)
- Lock to freeze as official, new draft created alongside locked version
- Tiered retention: financial 7yr, tax 7yr, WHT 7yr, management 2yr, drafts 30d
- Soft delete: 7-day configurable trash recovery before permanent deletion
- Daily Inngest cron cleanup at 02:00 ICT

## WHT Certificate System
- Atomic sequential numbering: WHT-YYYY-NNNN via tenants.nextWhtSequence
- Form routing: getWhtFormType() → PND3 (individual) / PND53 (company) / PP36 (non-resident)
- Void/reissue with audit trail (replaces_id, voided watermark)
- Data snapshotted at generation time (immutable legal documents)
