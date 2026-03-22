# Auth, Onboarding, Settings & Account Management Rework

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Registration flow fixes, dedicated onboarding pages, settings overhaul, delete account/workspace

---

## Overview

Rework the authentication foundations, onboarding flow, settings pages, and add account/workspace deletion to bring AICount to production-grade quality. Follows the Phase 1 UI/UX design system specification for visual direction.

Four sequential workstreams:
1. Auth foundations (fix critical gaps)
2. Dedicated onboarding flow (replace modal)
3. Settings overhaul (proper SaaS settings panel)
4. Delete account & workspace (soft delete with 30-day grace period)

---

## Section 1: Auth Foundations

### 1.1 Auth Callback Route

**New file:** `src/app/auth/callback/route.ts`

This route lives outside both `(auth)` and `(app)` route groups intentionally — it needs no layout and is a pure server-side redirect handler.

Handles Supabase email confirmation redirects:
- Exchanges the auth code for a session via `supabase.auth.exchangeCodeForSession()`
- Checks `isOnboardingComplete` on the user's profile
- Redirects to `/onboarding` (new users) or `/dashboard` (existing users)

### 1.2 Email Verification Enforcement

**New file:** `src/app/(auth)/signup/verify-email/page.tsx`

After signup, redirect to a "Check your email" page instead of straight to login:
- Shows the email address they signed up with
- "Resend verification email" button
- "Back to login" link

**Middleware update** (`src/lib/supabase/middleware.ts`):
- Check `email_confirmed_at` on the Supabase user object
- Unverified users are redirected to a "Please verify your email" page
- Exception: `/auth/callback`, `/signup/verify-email`, and `/api` routes

### 1.3 CSRF Verification

The existing `validateCsrf()` in `src/lib/api/csrf.ts` uses origin-based CSRF checking (comparing `Origin` header against `NEXT_PUBLIC_APP_URL`). This is sufficient for our use case since all auth forms are same-origin.

What needs fixing:
- Ensure all auth API calls from frontend include proper `Origin` header (fetch defaults handle this)
- Verify `NEXT_PUBLIC_APP_URL` is correctly set in production environment
- No token-based CSRF needed — origin-based approach is adequate for server-side rendered forms

### 1.4 Consolidate App URL

**New utility:** `src/lib/utils/app-url.ts`

```ts
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://aicount-mocha.vercel.app";
}
```

Replace all hardcoded URLs in:
- `src/app/api/auth/register/route.ts`
- `src/app/api/tenants/[id]/invitations/route.ts`
- Any other files referencing the app URL

### 1.5 Files Summary

| Action | File |
|--------|------|
| Create | `src/app/auth/callback/route.ts` |
| Create | `src/app/(auth)/signup/verify-email/page.tsx` |
| Create | `src/lib/utils/app-url.ts` |
| Modify | `src/app/(auth)/signup/page.tsx` — redirect to verify-email |
| Modify | `src/app/api/auth/register/route.ts` — use `getAppUrl()` |
| Modify | `src/app/api/tenants/[id]/invitations/route.ts` — use `getAppUrl()` |
| Modify | `src/lib/supabase/middleware.ts` — email verification check |

---

## Section 2: Dedicated Onboarding Flow

### 2.1 Route Structure

Replace the onboarding modal with dedicated pages:

| Route | Purpose |
|-------|---------|
| `/onboarding` | Welcome page, "Let's get started" CTA |
| `/onboarding/workspace` | Create workspace (company name + tax ID) |
| `/onboarding/chart-of-accounts` | Import/add initial GL codes |
| `/onboarding/departments` | Add cost centers |
| `/onboarding/team` | Invite team members (maker/checker) |
| `/onboarding/template` | Choose Express export template |
| `/onboarding/complete` | Success page, "Go to Dashboard" CTA |

### 2.2 Layout

**New file:** `src/app/(onboarding)/layout.tsx`

- Clean centered layout (max-width ~800px)
- Progress bar at top showing current step (7 steps including welcome and complete)
- Step indicator with labels
- No app sidebar — onboarding is its own experience

### 2.3 State Management

**Schema change:** Add `onboardingStep` (integer, default 0) to `profiles` table.

**Step-to-index mapping:**
| Index | Route | Step |
|-------|-------|------|
| 0 | `/onboarding` | Welcome |
| 1 | `/onboarding/workspace` | Create workspace |
| 2 | `/onboarding/chart-of-accounts` | Chart of accounts |
| 3 | `/onboarding/departments` | Departments |
| 4 | `/onboarding/team` | Invite team |
| 5 | `/onboarding/template` | Export template |
| 6 | `/onboarding/complete` | Complete |

- Each step saves data immediately via existing API calls
- `onboardingStep` updated via `PATCH /api/auth/profile` after each successful save (this endpoint already exists and will accept the new `onboardingStep` field)
- If user closes browser and returns, middleware redirects to correct step
- Steps 2-4 (COA, departments, team) are skippable with "I'll do this later" link
- Skipping advances `onboardingStep` without saving step-specific data

### 2.4 Middleware Behavior

In `src/lib/supabase/middleware.ts`:
- If `isOnboardingComplete === false` and user navigates to an app route → redirect to `/onboarding`
- Calculate correct onboarding step from `onboardingStep` value
- Invited users have `isOnboardingComplete === true` → skip entirely

### 2.5 Completion

On the final step (`/onboarding/complete`):
- Set `isOnboardingComplete = true` via `PATCH /api/auth/profile`
- Set `onboardingStep = 6`
- "Go to Dashboard" button redirects to `/dashboard`

### 2.6 Files Summary

| Action | File |
|--------|------|
| Create | `src/app/(onboarding)/layout.tsx` |
| Create | `src/app/(onboarding)/onboarding/page.tsx` |
| Create | `src/app/(onboarding)/onboarding/workspace/page.tsx` |
| Create | `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx` |
| Create | `src/app/(onboarding)/onboarding/departments/page.tsx` |
| Create | `src/app/(onboarding)/onboarding/team/page.tsx` |
| Create | `src/app/(onboarding)/onboarding/template/page.tsx` |
| Create | `src/app/(onboarding)/onboarding/complete/page.tsx` |
| Delete | `src/components/onboarding-modal.tsx` |
| Modify | `src/app/(app)/layout.tsx` — remove onboarding modal logic |
| Modify | `src/lib/supabase/middleware.ts` — add onboarding redirect |
| Modify | `src/lib/db/schema.ts` — add `onboardingStep` to profiles |
| Migration | Add `onboarding_step` column to `profiles` table |

---

## Section 3: Settings Overhaul

### 3.1 Settings Layout

**New file:** `src/app/(app)/settings/layout.tsx`

Settings gets its own sidebar navigation within the app content area:

```
┌─────────────────────┬──────────────────────────────┐
│ Settings Sidebar     │  Content Area               │
│                      │                              │
│ ACCOUNT              │                              │
│  Profile             │                              │
│  Security            │                              │
│  Delete Account      │                              │
│                      │                              │
│ WORKSPACE            │                              │
│  General             │  (selected page renders)     │
│  Members & Roles     │                              │
│  Invitations         │                              │
│  Delete Workspace    │                              │
│                      │                              │
│ MASTER DATA          │                              │
│  Chart of Accounts   │                              │
│  Vendors             │                              │
│  Customers           │                              │
│  Products            │                              │
│  Departments         │                              │
│                      │                              │
│ ACCOUNTING           │                              │
│  Export Templates     │                              │
│  Period Locks        │                              │
│  Bank Reconciliation │                              │
│  Tax Reports         │                              │
└─────────────────────┴──────────────────────────────┘
```

- Sidebar is inside the content area (not replacing the app sidebar)
- On mobile: sidebar becomes a dropdown/accordion navigation
- Active page highlighted in sidebar

### 3.2 Route Structure

| Route | Purpose |
|-------|---------|
| `/settings` | Redirects to `/settings/profile` |
| `/settings/profile` | Name, email (read-only) |
| `/settings/security` | Change password, active sessions |
| `/settings/delete-account` | Account deletion flow (Section 4) |
| `/settings/workspace/general` | Name, tax ID, VAT, currency, data retention |
| `/settings/workspace/members` | Members table with role management |
| `/settings/workspace/invitations` | Pending/accepted invitations, resend, revoke |
| `/settings/workspace/delete` | Workspace deletion flow (Section 4) |
| `/settings/masterdata/coa` | Chart of accounts |
| `/settings/masterdata/vendors` | Vendors |
| `/settings/masterdata/customers` | Customers |
| `/settings/masterdata/products` | Products |
| `/settings/masterdata/departments` | Departments |
| `/settings/accounting/templates` | Export templates |
| `/settings/accounting/period-locks` | Period locks |
| `/settings/accounting/bank-recon` | Bank reconciliation |
| `/settings/accounting/tax-reports` | Tax reports |

### 3.3 Workspace Context

- Workspace-scoped pages (workspace/*, masterdata/*, accounting/*) use the currently selected workspace from the workspace selector
- No tenant ID in the URL — derived from workspace selector context
- If no workspace selected, show empty state prompting user to select one

### 3.4 Key UX Improvements

- **Members page** replaces old assignments page — shows user table with name, email, role, joined date, and remove button
- **Invitations page** — separate from members, shows pending/accepted with resend and revoke actions
- **Master data pages** — same content as before but consistent table UX with search, pagination
- **Security page** — new, allows password change via Supabase auth

### 3.5 Files Summary

| Action | File |
|--------|------|
| Create | `src/app/(app)/settings/layout.tsx` |
| Create | `src/app/(app)/settings/profile/page.tsx` |
| Create | `src/app/(app)/settings/security/page.tsx` |
| Create | `src/app/(app)/settings/delete-account/page.tsx` |
| Create | `src/app/(app)/settings/workspace/general/page.tsx` |
| Create | `src/app/(app)/settings/workspace/members/page.tsx` |
| Create | `src/app/(app)/settings/workspace/invitations/page.tsx` |
| Create | `src/app/(app)/settings/workspace/delete/page.tsx` |
| Create | `src/app/(app)/settings/masterdata/coa/page.tsx` |
| Create | `src/app/(app)/settings/masterdata/vendors/page.tsx` |
| Create | `src/app/(app)/settings/masterdata/customers/page.tsx` |
| Create | `src/app/(app)/settings/masterdata/products/page.tsx` |
| Create | `src/app/(app)/settings/masterdata/departments/page.tsx` |
| Create | `src/app/(app)/settings/accounting/templates/page.tsx` |
| Create | `src/app/(app)/settings/accounting/period-locks/page.tsx` |
| Create | `src/app/(app)/settings/accounting/bank-recon/page.tsx` |
| Create | `src/app/(app)/settings/accounting/tax-reports/page.tsx` |
| Create | `src/app/api/auth/account/route.ts` |
| Create | `src/app/api/auth/account/cancel-deletion/route.ts` |
| Delete | `src/app/(app)/settings/page.tsx` — old monolithic page |
| Delete | `src/app/(app)/settings/tenants/[id]/**` — all old tenant-scoped routes |

---

## Section 4: Delete Account & Delete Workspace

### 4.1 Schema Changes

**`tenants` table — add columns:**
- `deletedAt` — timestamp, nullable
- `deletionScheduledFor` — timestamp, nullable (deletedAt + 30 days)

**`profiles` table — add columns:**
- `deletedAt` — timestamp, nullable
- `deletionScheduledFor` — timestamp, nullable (deletedAt + 30 days)

### 4.2 Delete Workspace Flow

**Page:** `/settings/workspace/delete`

1. Shows workspace name, member count, data summary (document count, journal entries)
2. User clicks "Delete Workspace"
3. **Ownership check:**
   - If other members exist → must transfer ownership first (dropdown of members) OR confirm deletion if sole member
   - Transfer ownership: `POST /api/tenants/[id]/transfer-ownership`
4. Confirmation modal: type workspace name to confirm
5. Soft delete: set `deletedAt = now()`, `deletionScheduledFor = now() + 30 days`
6. All members see banner: "This workspace will be permanently deleted on [date]"
7. Owner can cancel via `POST /api/tenants/[id]/cancel-deletion`

**During grace period:**
- Workspace is read-only — no new uploads, no edits
- Members can still view and export data
- Banner with "Cancel deletion" button visible to owner

**After 30 days:**
- Inngest function `workspace.purge` permanently deletes all workspace data
- Cascades: documents, journal entries, master data, assignments, invitations

### 4.3 Delete Account Flow

**Page:** `/settings/delete-account`

1. Shows account info (name, email)
2. Lists all workspaces user owns
3. For each owned workspace with other members: choose **Transfer ownership** or **Delete workspace**
4. For each owned workspace where user is sole member: auto-marked for deletion
5. Confirmation modal: type email to confirm
6. Soft delete: set `deletedAt = now()`, `deletionScheduledFor = now() + 30 days`
7. User logged out immediately
8. If user logs back in during grace period: sees "Account scheduled for deletion on [date]" page with "Cancel deletion" button
9. After 30 days: Inngest function `account.purge` permanently deletes profile, assignments, triggers workspace deletions for solely-owned workspaces

### 4.4 API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| DELETE | `/api/auth/account` | Initiate account deletion (soft delete) |
| POST | `/api/auth/account/cancel-deletion` | Cancel account deletion |
| PATCH | `/api/tenants/[id]` | Initiate workspace deletion (set `deletedAt`) |
| POST | `/api/tenants/[id]/cancel-deletion` | Cancel workspace deletion |
| POST | `/api/tenants/[id]/transfer-ownership` | Transfer workspace ownership |

### 4.5 Inngest Functions

**`workspace.purge`** (`src/lib/inngest/functions/workspace-purge.ts`):
- Runs on schedule (daily)
- Queries tenants where `deletionScheduledFor <= now()`
- Hard deletes all related data via cascade
- Sends confirmation email to owner

**`account.purge`** (`src/lib/inngest/functions/account-purge.ts`):
- Runs on schedule (daily)
- Queries profiles where `deletionScheduledFor <= now()`
- Triggers workspace purge for solely-owned workspaces
- Deletes Supabase auth user
- Hard deletes profile and all assignments
- Sends confirmation email

### 4.6 Middleware Updates

In `src/lib/supabase/middleware.ts`:

**Priority chain** (evaluated in order, first match wins):
1. Email verification — unverified users → redirect to verify-email page
2. Account deletion pending — `profiles.deletedAt` set → redirect to deletion-pending page
3. Onboarding incomplete — `isOnboardingComplete === false` → redirect to onboarding
4. Workspace deletion pending — `tenants.deletedAt` set → set `x-workspace-deleted` response header; layout component reads this to show banner and enforce read-only mode

### 4.7 Race Condition Handling

**Concurrent account + workspace deletion:**
- If a workspace already has a pending deletion when account deletion is initiated, keep the workspace's existing (possibly earlier) `deletionScheduledFor` — don't reset it
- Cancelling account deletion also cancels any workspace deletions that were triggered as part of the account deletion flow (tracked via a `deletionReason` field: `"owner_request"` vs `"account_deletion"`)
- Workspace deletions initiated independently (not via account deletion) are NOT cancelled when account deletion is cancelled

**Authorization for deletion endpoints:**
- `PATCH /api/tenants/[id]` (soft delete) — only workspace owner (`tenants.ownerUserId`)
- `POST /api/tenants/[id]/cancel-deletion` — only workspace owner
- `POST /api/tenants/[id]/transfer-ownership` — only workspace owner
- `DELETE /api/auth/account` — only the authenticated user (self)
- `POST /api/auth/account/cancel-deletion` — only the authenticated user (self)

### 4.8 Workspace Selector Handoff

After onboarding completes, the workspace selector (`src/components/workspace-selector.tsx`) must be pre-populated with the workspace the user just created. The onboarding complete step sets `workspaceTenantId` in `localStorage` before redirecting to `/dashboard`.

### 4.9 Files Summary

| Action | File |
|--------|------|
| Create | `src/app/(app)/settings/workspace/delete/page.tsx` |
| Create | `src/app/(app)/settings/delete-account/page.tsx` |
| Create | `src/app/api/auth/account/route.ts` |
| Create | `src/app/api/auth/account/cancel-deletion/route.ts` |
| Modify | `src/app/api/tenants/[id]/route.ts` — add soft delete via PATCH |
| Create | `src/app/api/tenants/[id]/cancel-deletion/route.ts` |
| Create | `src/app/api/tenants/[id]/transfer-ownership/route.ts` |
| Create | `src/lib/inngest/functions/workspace-purge.ts` |
| Create | `src/lib/inngest/functions/account-purge.ts` |
| Modify | `src/lib/db/schema.ts` — add deletion columns |
| Modify | `src/lib/supabase/middleware.ts` — deletion checks |
| Migration | Add `deleted_at`, `deletion_scheduled_for` to `tenants` and `profiles` |

---

## Migration Summary

Two database migrations needed:

### Migration 1: Onboarding step
```sql
ALTER TABLE profiles ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0;
```

### Migration 2: Soft delete columns
```sql
ALTER TABLE tenants ADD COLUMN deleted_at timestamptz;
ALTER TABLE tenants ADD COLUMN deletion_scheduled_for timestamptz;
ALTER TABLE tenants ADD COLUMN deletion_reason text;
ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
ALTER TABLE profiles ADD COLUMN deletion_scheduled_for timestamptz;

-- Partial indexes for Inngest purge queries
CREATE INDEX idx_tenants_deletion_scheduled ON tenants (deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL;
CREATE INDEX idx_profiles_deletion_scheduled ON profiles (deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL;
```

---

## Implementation Order

1. **Auth foundations** — callback route, email verification, CSRF, app URL utility
2. **Onboarding pages** — layout, 7 pages, middleware redirect, remove modal
3. **Settings layout + account pages** — settings sidebar, profile, security
4. **Settings workspace pages** — general, members, invitations
5. **Settings master data pages** — migrate existing pages to new routes
6. **Settings accounting pages** — migrate existing pages to new routes
7. **Delete workspace** — API, UI, Inngest function
8. **Delete account** — API, UI, Inngest function, ownership transfer
9. **Cleanup** — remove old routes, old settings page, old onboarding modal
