---
name: aicount-frontend-ui
description: >-
  Guides React and Next.js App Router UI work in the aicount repo: where screens
  live, shared components, fetch/tenant patterns, Tailwind conventions, and
  B2B accounting UX. Use when editing UI under src/app/(app) or
  src/components, or when the user asks for frontend, layout, styling, or
  client-side behavior in this project.
---

# aicount — frontend UI

## First: product context

This app is B2B express-accounting workflows (documents, approvals, periods, exports, tenant settings). **Product tone, honest states, and tenancy rules** are defined in the workspace rule `.cursor/rules/product-and-ui-standards.mdc` — read it when changing copy or user-visible flows; do not contradict it.

## Repo map (where UI lives)

| Area | Role |
|------|------|
| `src/app/(app)/` | Logged-in shell and feature pages (sidebar from `(app)/layout.tsx`) |
| `src/app/(auth)/` | Login, signup, invite |
| `src/components/` | Cross-route pieces: workspace, search, onboarding, offline banner |
| `src/app/api/` | Route handlers — UI calls these with `fetch`, not direct DB from the browser. Handler patterns: `.cursor/skills/aicount-backend-api/SKILL.md`. |

Match **typography, spacing, and Tailwind** to the file you are editing and to `(app)/layout.tsx` (e.g. `slate-*`, `border-slate-200`, compact controls).

## React / Next.js patterns in this repo

- **Client pages**: Interactive screens use `"use client"` at the top when they need hooks, events, or browser APIs.
- **Routing**: Use `next/link` and `usePathname` / `useRouter` from `next/navigation` the same way as `(app)/layout.tsx`.
- **Types**: Prefer explicit `type` aliases for list rows and API-shaped data (see existing pages for examples).
- **No new visual system**: Reuse sidebar patterns, button classes, and table/card layouts from neighboring routes before introducing new primitives.

## Data from the browser

- Call **`/api/...`** with `fetch`. Parse JSON and branch on **`json.success`** (and `json.error` when present) — never assume success from HTTP 200 alone.
- **Tenant scope**: Read the active tenant with `getWorkspaceTenantId()` from `@/components/workspace-selector`. Pass `tenantId` in query strings or JSON bodies **exactly** as sibling routes already do for the same resource.
- **Errors**: Surfaces must stay **honest** — failed load, empty tenant, or `success: false` need a clear message and a sensible next step (retry, pick client, adjust period), not a silent empty UI or fake success.

## Shared components (check before duplicating)

- `WorkspaceSelector` / `getWorkspaceTenantId` / `isDefaultWorkspaceTenantId` — current tenant; changing storage or keys affects the whole app.
- `OnboardingModal`, `GlobalSearch`, `OfflineBanner` — shell-level behavior; coordinate with `(app)/layout.tsx` if you touch navigation or global chrome.

## UX checklist for UI edits

- **Labels and copy** use accounting/document language (tenant, period, journal, export, approval) — not marketing or gamified tone.
- **Loading**: Show that work is in progress where the user waits (buttons disabled, inline text, or skeleton consistent with the page).
- **Empty**: Explain why there is nothing and what to do (e.g. select a template, choose a client, upload first).
- **Destructive actions**: Make danger obvious (wording + styling); align with patterns on similar pages.
- **Density**: Prefer scannable tables and clear primary actions for ops users.

## Before handing off

- Run **`npm run lint`** after non-trivial edits; fix what you introduced.
- For larger TS/React changes, run **`npx tsc --noEmit`** or **`npm run build`** when appropriate.
- Confirm **error paths** still show actionable text, not blank screens.
