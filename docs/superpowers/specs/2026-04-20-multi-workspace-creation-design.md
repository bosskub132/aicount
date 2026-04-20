# Multi-Workspace Creation — Design Spec

**Date:** 2026-04-20
**Branch:** `feature/muti-workspace`
**Status:** Draft — pending implementation plan

## Problem

The codebase already supports multi-tenant architecture (`tenants`, `tenant_assignments`, `WorkspaceSelector`, `POST /api/tenants`), but there is **no UI entry point** for a user to create an additional workspace after their first one. The existing empty-state in `WorkspaceSelector` tells users to "create a client in Settings", but no such settings entry exists.

Additionally, the current onboarding state lives on the `profiles` table (`isOnboardingComplete`, `onboardingStep`) — a per-user flag. Reusing the existing onboarding flow for a second workspace would flip this flag to `false` and lock the user out of their original workspace until the new onboarding is complete.

## Goals

1. Allow any authenticated user to create additional workspaces.
2. Reuse the existing 8-step onboarding flow for each new workspace.
3. Let users switch freely between completed and in-progress workspaces.
4. Allow users to pick a default workspace that auto-loads on login / cleared cookies.
5. Surface incomplete workspaces clearly and let users resume or abandon them.

## Non-Goals

- Subscription / per-user tier caps on workspace count (deferred — pilot-test first).
- Superadmin "create workspace on behalf of another user" (separate backoffice feature).
- Workspace templates / cloning (future enhancement).
- Rate limiting beyond existing API-wide limits.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Entry points: WorkspaceSelector dropdown footer button **and** Settings sidebar item | Both discoverable + contextual. Confirm dialog before routing. |
| 2 | Onboarding state moves from `profiles` to `tenants` (A2 migration — full replacement, no dual state) | Clean source of truth; no hybrid logic; matches product semantics (each workspace has its own setup). |
| 3 | Any authenticated user can create a workspace | Removes admin-gate friction for invited-only users; tier caps added later. |
| 4 | Abandoned workspaces stay on the account with a "Setup incomplete" marker; user can resume or delete manually | Real users get interrupted. Auto-cleanup is magic; explicit discard is friction. |
| 5 | User can pick a default workspace; middleware auto-selects on cookie-absent | Eliminates repeated "select a workspace" after login / clear cookies. |
| 6 | Onboarding writes use path-parameter endpoints (`/api/tenants/[id]/onboarding`), not `/current` | Auditable, matches existing `PUT /api/tenants/[id]` pattern, prevents wrong-tenant writes under tab-race conditions. |

## Data Model

### Schema changes (one Drizzle migration)

**Add to `tenants`:**
```sql
ALTER TABLE tenants
  ADD COLUMN is_onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0;
```

**Add to `profiles`:**
```sql
ALTER TABLE profiles
  ADD COLUMN default_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;
```

**Backfill (in the same migration, before drops):**
```sql
-- Mark all existing tenants as complete if any assigned user had completed their onboarding.
UPDATE tenants t
SET is_onboarding_complete = true, onboarding_step = 8
WHERE EXISTS (
  SELECT 1 FROM tenant_assignments ta
  JOIN profiles p ON p.id = ta.user_id
  WHERE ta.tenant_id = t.id AND p.is_onboarding_complete = true
);

-- Set each user's default to their oldest tenant assignment.
UPDATE profiles p
SET default_tenant_id = (
  SELECT tenant_id FROM tenant_assignments
  WHERE user_id = p.id
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE p.default_tenant_id IS NULL;
```

**Drop from `profiles`:**
```sql
ALTER TABLE profiles
  DROP COLUMN is_onboarding_complete,
  DROP COLUMN onboarding_step;
```

### Invariants

- `tenants.ownerUserId` unchanged — ownership != default.
- `profiles.default_tenant_id` may be NULL (no default set, or default workspace was deleted).
- `tenants.onboarding_step` is monotonic — step writes use `GREATEST(current, incoming)` semantics.

## API Surface

| Endpoint | Method | Status | Behavior |
|---|---|---|---|
| `/api/tenants` | POST | **Modified** | Remove admin gate (lines 68-79 of current route). Any authenticated user may create. Wrap tenant insert + 2 `tenant_assignments` rows (maker + checker) in a transaction. Audit metadata: include `isFirstWorkspace: boolean` on existing `tenant.created` event. |
| `/api/tenants` | GET | **Modified** | Response items include `isOnboardingComplete` + `isDefault`. |
| `/api/tenants/[id]/onboarding` | GET, PATCH | **New** | GET returns `{ onboardingStep, isOnboardingComplete }`. PATCH accepts `{ onboardingStep?, isOnboardingComplete? }`. Uses `GREATEST` for step. 403 if `[id]` not in user's assignments. |
| `/api/profile/default-workspace` | PATCH | **New** | Body: `{ tenantId: string \| null }`. 403 if `tenantId` not in user's assignments. Writes `profiles.default_tenant_id`. |
| `/api/auth/profile` | PATCH | **Modified** | Remove `onboardingStep` and `isOnboardingComplete` from accepted body keys. Other fields unchanged. |
| `/api/invite/[token]` | POST | **Modified** | Drop the profile-flag write (lines 102-105 of current route). Invited tenant is already complete; no profile state to flip. |
| `/api/workspace/switch` | POST | Unchanged | Cookie-switch already works. |

## Middleware

`src/lib/supabase/middleware.ts` — tenant resolution order when `workspaceTenantId` cookie is absent or invalid:

1. `profiles.default_tenant_id`, if user still has a `tenant_assignments` row for it.
2. Oldest `tenant_assignments.tenant_id` for the user.
3. Leave unset — client shows "select workspace" prompt.

Middleware sets both `workspaceTenantId` (httpOnly) and `workspaceTenantIdPublic` cookies when it resolves one.

## Routing Guard

`src/app/(app)/layout.tsx`:

- Replace `!json.data.isOnboardingComplete` check with tenant-scoped lookup (cookie tenant).
- If no `tenant_assignments` exist for user → redirect to `/onboarding` (welcome).
- If cookie tenant's `isOnboardingComplete === false` → redirect to `STEP_ROUTES[clamp(onboarding_step, 0, 8)]`.
- Otherwise allow.

## Components & UI

### Modified

**`src/components/workspace-selector.tsx`**
- New leftmost star icon per row (filled = default; click to `PATCH /api/profile/default-workspace`).
- New "Setup incomplete" amber pill rendered below tax ID if `isOnboardingComplete=false`.
- New `+ Create New Workspace` footer button (below list, above an empty-state message if no workspaces).
- Update `GET /api/tenants` consumption to read new `isOnboardingComplete` + `isDefault` fields.

**`src/app/(app)/settings/layout.tsx`**
- Add nav item `{ label: "Create New Workspace", href: "/settings/workspace/new", icon: Plus }` in the `WORKSPACE` group, above "Delete Workspace".

**`src/app/(app)/settings/workspace/general/page.tsx`**
- Add "Set as default workspace" toggle row. Off state = "Not your default workspace". On state (disabled) = "Default workspace ✓".

**`src/app/(onboarding)/onboarding/*/page.tsx`** (all seven step pages)
- Each page's "Next" action changes from `PATCH /api/auth/profile { onboardingStep: N }` to `PATCH /api/tenants/[id]/onboarding { onboardingStep: N }` using the current cookie tenant's id.
- `complete/page.tsx` sets `isOnboardingComplete=true` on the tenant. If the user has no `default_tenant_id`, set it to this tenant.
- Each step gets a secondary "Finish later" button — hidden when the user has no other workspace assignment, visible otherwise. Click: `POST /api/workspace/switch` to previous tenant → `router.push("/")`.
- `workspace/page.tsx` — accept `?new=true` query param. When present, skip the pre-fill logic (lines 32-54) and always `POST /api/tenants` instead of `PUT`.

### New

**`src/app/(app)/settings/workspace/new/page.tsx`**
- Brief explainer copy + primary "Start creating workspace" button that opens the confirm dialog.

**`src/components/create-workspace-confirm-dialog.tsx`**
- Uses existing `Modal` primitive (`open` prop, `actions` slot).
- Title: "Create a new workspace?"
- Body: explains the new workspace will go through onboarding and the current workspace stays accessible.
- Actions: Cancel (secondary) / Continue (primary → `router.push("/onboarding/workspace?new=true")`).

**`src/components/resume-onboarding-banner.tsx`**
- Rendered in `(app)/layout.tsx` when cookie tenant has `isOnboardingComplete=false`.
- Sticky yellow banner. Text: "Setup for [name] is incomplete — step N of 8."
- Buttons: "Resume setup" (→ `STEP_ROUTES[step]`), "Switch workspace" (focuses the selector).

## Flows

### New user signup

```
signup → profiles row created → no assignments, no default, no cookie
↓
middleware: no cookie, no fallback → cookie unset
↓
(app)/layout.tsx guard: no assignments → redirect /onboarding (welcome)
↓
/onboarding/workspace: POST /api/tenants → POST /api/workspace/switch → PATCH /api/tenants/[id]/onboarding { step: 2 }
↓
... (6 more steps) ...
↓
/onboarding/complete: PATCH /api/tenants/[id]/onboarding { isOnboardingComplete: true, step: 8 }
                       + PATCH /api/profile/default-workspace { tenantId: [id] }  (auto-set first default)
↓
redirect /
```

### Existing user creates second workspace

```
user on dashboard of Workspace A
↓
clicks "+ Create New Workspace" (selector footer OR settings sidebar)
↓
CreateWorkspaceConfirmDialog opens → Continue
↓
router.push("/onboarding/workspace?new=true")
↓
POST /api/tenants (creates Workspace B) → POST /api/workspace/switch (cookie → B)
                                         → PATCH /api/tenants/[B]/onboarding { step: 2 }
↓
... (6 more steps; each has "Finish later" → switch back to A) ...
↓
/onboarding/complete: PATCH /api/tenants/[B]/onboarding { isOnboardingComplete: true }
                       (default_tenant_id NOT touched; stays on A)
↓
redirect /
```

### Resume abandoned workspace

```
user on dashboard of Workspace A
selector shows: Workspace A ★ active | Workspace B ☆ [Setup incomplete]
↓
user clicks Workspace B → POST /api/workspace/switch (cookie → B)
↓
(app)/layout.tsx guard: B.isOnboardingComplete=false → redirect STEP_ROUTES[B.onboarding_step]
↓
user completes or clicks "Finish later" → back to A
```

### Invitee flow

```
invitee accepts invite token → POST /api/invite/[token]
↓
insert tenant_assignments row (role from invite)
set workspaceTenantId cookie to invited tenant
(no profile state flipped; tenant is already complete)
↓
middleware: cookie is valid → allow
(app)/layout.tsx guard: tenant.isOnboardingComplete=true → allow
↓
invitee lands in the invited workspace's dashboard directly
```

## Error Handling & Edge Cases

- **Atomic creation** — `POST /api/tenants` uses a Drizzle transaction for tenant + 2 assignments. Rollback on failure. Prevents orphan tenants.
- **Default workspace deleted** — `ON DELETE SET NULL` on `profiles.default_tenant_id`. Middleware falls through to oldest assignment.
- **User removed from their default** — "remove member" endpoint explicitly nullifies matching `default_tenant_id` values.
- **Tax ID uniqueness** — enforce via unique constraint on `tenants.tax_id`. POST returns 409 "A workspace with this tax ID already exists" on duplicate.
- **Step race (two tabs)** — `UPDATE tenants SET onboarding_step = GREATEST(onboarding_step, $1)` prevents regression.
- **Corrupt step value** — guard clamps to `[0, STEP_ROUTES.length - 1]`.
- **No previous workspace** — "Finish later" button hidden.
- **PATCH default-workspace with tenantId user can't access** — 403.
- **Client errors** — confirm dialog keeps open with inline error on POST failure; toast on switch / default-set failures.
- **NEVER expose raw `error.message`** — per CLAUDE.md. Log server-side, return generic messages.

## Audit Logging

Existing `tenant.created` event (from `src/app/api/tenants/route.ts:108`) fires for every workspace creation — unchanged.

New events (via existing `writeAuditLog`):
- `workspace.default_changed` — user set/changed default tenant
- `workspace.onboarding_abandoned` — user clicked "Finish later"
- `workspace.onboarding_completed` — user finished onboarding for a tenant

The creator's assignment count at audit-write time is included in `tenant.created` metadata (`isFirstWorkspace: boolean`) so existing events remain the single source of truth for creation — no need for a separate `_additional` variant.

## Client-Tenant-Header Invariant

All new client-side fetches MUST follow the existing rule (see `src/lib/test/no-client-tenant-header.test.ts`):
- Never set `x-tenant-id` header from client.
- Never pass `?tenantId=` query params from client.
- For tenant-scoped onboarding writes, put the tenant id **in the URL path** (`/api/tenants/[id]/onboarding`), which is not covered by the header rule and is validated against `ctx.tenantId` on the server.

## Testing Strategy

**Unit (Vitest):**
- `src/lib/db/queries/tenants.test.ts` — transaction rollback; `GREATEST` step update; tax ID duplicate.
- `src/lib/api/middleware.test.ts` — resolution fallback chain; revoked assignment fall-through.
- `src/app/api/tenants/[id]/onboarding/route.test.ts` — cross-tenant 403; clamping; completion flag.
- `src/app/api/profile/default-workspace/route.test.ts` — 403 when tenantId not in assignments.

**Integration:**
- Full first-time onboarding happy path → default auto-set.
- Second workspace flow → "Finish later" → resume → complete.
- Invite acceptance → no onboarding redirect.
- Migration backfill correctness.

**Contract:**
- Extend `src/lib/test/no-client-tenant-header.test.ts` to cover new client code (selector, confirm dialog, finish-later, default toggle).

**E2E (Playwright):**
- One critical flow: "Create second workspace → switch back → resume → complete".

**Manual QA checklist:** signup flow, default auto-set on first completion, create from both entry points, "Finish later", incomplete pill visible, star-click sets default without switching, cookie-clear lands on default, delete default falls through, invite skip.

## Rollout

Single atomic commit on `feature/muti-workspace` — code refactor (removing `profiles.is_onboarding_complete` / `profiles.onboarding_step` references across 6+ files) + migration + new components + new routes.

Per `feedback_staging_only_migrations.md`: apply to **staging only**; wait for explicit approval before production.

## Open Questions Deferred to Implementation

- Exact copy for confirm dialog, resume banner, and "Finish later" tooltip.
- Should the star icon and incomplete pill have tooltips (`title` attrs)?
- Should `/settings/workspace/new` be a full page or redirect immediately to `/onboarding/workspace?new=true` on load? (Currently: full page with explainer — lower surprise.)

## Files Touched (estimated)

**Schema / DB:**
- `src/lib/db/schema.ts`
- `supabase/migrations/XXXX_multi_workspace_onboarding.sql`
- `src/lib/db/queries/tenants.ts` (new or extended)

**API:**
- `src/app/api/tenants/route.ts`
- `src/app/api/tenants/[id]/onboarding/route.ts` (new)
- `src/app/api/profile/default-workspace/route.ts` (new)
- `src/app/api/auth/profile/route.ts`
- `src/app/api/invite/[token]/route.ts`
- `src/lib/supabase/middleware.ts`

**Pages:**
- `src/app/(app)/layout.tsx`
- `src/app/(app)/settings/layout.tsx`
- `src/app/(app)/settings/workspace/general/page.tsx`
- `src/app/(app)/settings/workspace/new/page.tsx` (new)
- `src/app/(onboarding)/onboarding/page.tsx`
- `src/app/(onboarding)/onboarding/workspace/page.tsx`
- `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx`
- `src/app/(onboarding)/onboarding/vendors-customers/page.tsx`
- `src/app/(onboarding)/onboarding/departments/page.tsx`
- `src/app/(onboarding)/onboarding/team/page.tsx`
- `src/app/(onboarding)/onboarding/template/page.tsx`
- `src/app/(onboarding)/onboarding/complete/page.tsx`

**Components:**
- `src/components/workspace-selector.tsx`
- `src/components/create-workspace-confirm-dialog.tsx` (new)
- `src/components/resume-onboarding-banner.tsx` (new)

**Tests:**
- `src/lib/test/no-client-tenant-header.test.ts` (extend)
- New test files for the new routes + updated queries
- One new Playwright spec for the critical flow
