---
name: aicount-backend-api
description: >-
  Guides Next.js App Router API routes, auth/tenant context, Drizzle DB access,
  and JSON contracts in the aicount repo. Use when editing or adding handlers
  under src/app/api, server lib under src/lib (api, db), background jobs
  (Inngest), or when pairing API work with UI that calls /api/....
user_invocable: true
---

# aicount — backend API

## Pair with the frontend skill

UI work is covered by **aicount-frontend-ui**. When a task spans both layers:

1. **Contract first**: Agree on JSON shape (`success`, `error`, payload fields) and how the client passes **`tenantId`** (body, query, or path) — match sibling routes for the same resource.
2. **Errors**: Return **`{ success: false, error: "..." }`** with an appropriate status so the client can show honest, actionable copy (see workspace rule `.cursor/rules/product-and-ui-standards.mdc`).
3. **Tenancy**: Every data path must stay tenant-scoped; never merge or leak rows across tenants.

## Repo map (where server work lives)

| Area | Role |
|------|------|
| `src/app/api/` | Route handlers (`route.ts` per HTTP method) |
| `src/lib/api/request-context.ts` | Auth-ish context from headers + `unauthorized` / `forbidden` helpers |
| `src/lib/db/` | Drizzle client, schema, migrations |
| `src/app/api/inngest/` | Inngest webhook handler for background work |

## Request context and security

- Use **`getRequestContext(request)`** from `@/lib/api/request-context`. If it returns `null`, respond with **`unauthorized()`** unless the route is intentionally public (e.g. health, invite token).
- Context carries **`userId`**, **`tenantId`**, **`role`** (`admin` | `maker` | `checker`), derived from headers (`x-user-id`, `x-tenant-id`, `x-user-role`, etc.). In **non-production**, a dev fallback may derive tenant from URL/query when headers are incomplete — do not rely on that for production-only guarantees; keep routes logically correct when context is full.
- When the body or query includes **`tenantId`**, enforce **`ensureTenantScope(ctx.tenantId, requestedTenantId)`** before touching tenant data. On mismatch, return **`forbidden("Cross-tenant access denied")`** (or equivalent).
- For role-sensitive actions, use **`ensureRole(ctx.role, [...])`** and/or **`resolveUserRole(userId, tenantId)`** when the effective role must come from **`tenant_assignments`** (e.g. checker-only flows). Follow patterns in existing `documents` routes.

## JSON responses

- Prefer **`NextResponse.json(...)`** with consistent shapes:
  - Success: `{ success: true, ...data }` (field names already used in the codebase).
  - Failure: `{ success: false, error: string }` plus **4xx/5xx** status.
- Validate required inputs early; return **400** with a clear `error` string — the UI branches on **`json.success`** and **`json.error`**.

## Database

- Use **`db`** from `@/lib/db` and tables/types from **`@/lib/db/schema`**. Keep queries filtered by **`tenantId`** (or join through tenant-scoped entities) the same way neighboring routes do.
- Prefer the same Drizzle patterns (`eq`, `and`, `inArray`, etc.) as the closest existing route.

## Export and Express handoff

- **`POST /api/export/express`**: Requires **`getRequestContext`** (authenticated); enforces **`ensureTenantScope`**. Passes **`templateId`** (static catalog key) into `exportApprovedDocumentsToExpress` for **`export_template_selections`** audit. Client must use **`credentials: "same-origin"`**.
- **`GET /api/auth/workspace-role?tenantId=`**: Returns effective **`maker` / `checker` / `admin`** (from assignments) and UI flags for submit vs approve — keep in sync with document submit/approve routes.

## Background and integrations

- **Inngest**: Changes that enqueue or handle jobs should align with `src/app/api/inngest/route.ts` and existing job patterns.
- **Webhooks** (e.g. Line): Treat as untrusted input; validate signatures/payloads as existing code does.

## Before handing off

- Run **`npm run lint`** after edits; fix what you introduced.
- For non-trivial TS changes, run **`npx tsc --noEmit`** or **`npm run build`** when appropriate.
- Re-read the handler's **401/403/400** paths — messages should be safe to show or map in the UI without implying success.
