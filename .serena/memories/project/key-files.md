# Key Files Reference (updated v1.1.0)

## Auth
- `src/lib/supabase/middleware.ts` — Auth middleware: session, email verification, role/tenant headers
- `src/app/auth/callback/route.ts` — Supabase email verification callback (outside route groups)
- `src/app/api/auth/register/route.ts` — Registration with Zod, CSRF, rate limiting
- `src/app/api/auth/profile/route.ts` — GET/PATCH profile (includes onboardingStep)
- `src/app/api/auth/resend-verification/route.ts` — Resend email verification
- `src/app/api/auth/account/route.ts` — DELETE account (soft delete with workspace actions)
- `src/app/api/auth/account/cancel-deletion/route.ts` — Cancel account deletion
- `src/lib/api/request-context.ts` — RequestContext extraction, ensureTenantScope, ensureRole
- `src/lib/api/csrf.ts` — Origin-based CSRF validation
- `src/lib/api/rate-limit.ts` — Upstash Redis rate limiter with in-process fallback

## Onboarding
- `src/app/(onboarding)/layout.tsx` — Stepper layout
- `src/app/(onboarding)/onboarding/*/page.tsx` — 7 step pages (welcome, workspace, coa, departments, team, template, complete)

## Settings
- `src/app/(app)/settings/layout.tsx` — Sidebar navigation (4 groups: Account, Workspace, Master Data, Accounting)
- `src/app/(app)/settings/profile/page.tsx` — Profile settings
- `src/app/(app)/settings/security/page.tsx` — Password change
- `src/app/(app)/settings/workspace/*/page.tsx` — General, members, invitations, delete
- `src/app/(app)/settings/masterdata/*/page.tsx` — COA, vendors, customers, products, departments
- `src/app/(app)/settings/accounting/*/page.tsx` — Templates, period-locks, bank-recon, tax-reports
- `src/app/(app)/settings/delete-account/page.tsx` — Account deletion flow

## Tenant/Workspace APIs
- `src/app/api/tenants/[id]/route.ts` — GET/PUT/PATCH(soft delete)/DELETE
- `src/app/api/tenants/[id]/cancel-deletion/route.ts` — Cancel workspace deletion
- `src/app/api/tenants/[id]/transfer-ownership/route.ts` — Transfer workspace ownership
- `src/app/api/tenants/[id]/invitations/route.ts` — CRUD invitations
- `src/app/api/tenants/[id]/assignments/route.ts` — CRUD member assignments

## Background Jobs
- `src/lib/inngest/functions/workspace-purge.ts` — Daily cron, hard-deletes expired workspaces
- `src/lib/inngest/functions/account-purge.ts` — Daily cron, hard-deletes expired accounts + Supabase auth user
- `src/app/api/inngest/route.ts` — Inngest serve handler (all functions registered here)

## Schema
- `src/lib/db/schema.ts` — Drizzle schema (profiles has onboardingStep, deletedAt, deletionScheduledFor; tenants has deletedAt, deletionScheduledFor, deletionReason)

## App Shell
- `src/app/(app)/layout.tsx` — Main layout: sidebar, header, onboarding redirect, deletion banner, version badge (v1.1.0)
