---
name: aicount-new-feature
description: >-
  End-to-end recipe for adding a new tenant-scoped feature to aicount: schema,
  RLS, API route, frontend page, Inngest job, and sidebar wiring. Use when
  building a new feature that spans multiple layers, adding a new settings page,
  or creating a new document workflow.
user_invocable: true
---

# aicount — adding a new feature (end-to-end)

This skill ties together the full stack. For deep guidance on each layer, see the dedicated skills:
- **aicount-db-schema** — tables, RLS, migrations
- **aicount-backend-api** — API routes, auth, JSON contracts
- **aicount-frontend-ui** — React pages, fetch patterns, UX
- **aicount-inngest-jobs** — background jobs, cron, events
- **thai-accounting-workflow** — accounting domain rules

## When to use this skill

Read this when you need to:
- Add a **new tenant-scoped feature** end-to-end
- Add a **new settings page** under tenant settings
- Create a **new API resource** with CRUD operations
- Wire up a **new document workflow** or processing step
- Add a **new report** or **export format**

## The recipe: 8 steps

### Step 1: Schema (if new data is needed)

**File:** `src/lib/db/schema.ts`

```typescript
export const myFeature = pgTable("my_feature", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  // business columns...
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("my_feature_tenant_code_idx").on(table.tenantId, table.code),
]);
```

**Then:**
- Add relations in `src/lib/db/relations.ts`
- Export type in `src/types/domain.ts`
- Write RLS policy in new migration file
- Run `npx drizzle-kit push` (dev) or `npx drizzle-kit generate` (prod migration)

See **aicount-db-schema** for full details.

### Step 2: Query helpers (optional)

**File:** `src/lib/db/queries/my-feature.ts`

```typescript
import { db } from "@/lib/db";
import { myFeature } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getMyFeatureItems(tenantId: string) {
  return db.select().from(myFeature)
    .where(and(eq(myFeature.tenantId, tenantId), eq(myFeature.isActive, true)));
}
```

### Step 3: Service logic (if complex business rules)

**File:** `src/lib/services/my-feature.ts`

Keep pure business logic separate from API handlers. Services should:
- Accept explicit parameters (not raw Request objects)
- Return typed results
- Throw descriptive errors for validation failures
- Stay tenant-aware (accept tenantId parameter)

### Step 4: API route

**File:** `src/app/api/tenants/[id]/my-feature/route.ts`

Follow the departments route pattern — the simplest CRUD template in the project:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { myFeature } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";

// GET — list items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id: tenantId } = await params;
  if (ctx.tenantId && ctx.tenantId !== tenantId) return forbidden("Cross-tenant access denied");

  try {
    const rows = await db.select().from(myFeature)
      .where(and(eq(myFeature.tenantId, tenantId), eq(myFeature.isActive, true)));
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to load data" }, { status: 500 });
  }
}

// POST — create item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id: tenantId } = await params;
  if (ctx.tenantId && ctx.tenantId !== tenantId) return forbidden("Cross-tenant access denied");

  try {
    const body = await request.json();
    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    const [row] = await db.insert(myFeature).values({
      tenantId,
      name: body.name,
      // other fields...
    }).returning();

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to create" }, { status: 500 });
  }
}

// PUT — update item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id: tenantId } = await params;
  const body = await request.json();

  try {
    const [updated] = await db.update(myFeature)
      .set({ name: body.name, updatedAt: new Date() })
      .where(and(eq(myFeature.id, body.id), eq(myFeature.tenantId, tenantId)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to update" }, { status: 500 });
  }
}

// DELETE — soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id: tenantId } = await params;
  const body = await request.json();

  try {
    await db.update(myFeature)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(myFeature.id, body.id), eq(myFeature.tenantId, tenantId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
```

**Key patterns:**
- `getRequestContext(request)` for auth — return `unauthorized()` if null
- Tenant ID from URL params: `const { id: tenantId } = await params`
- Cross-tenant check: `if (ctx.tenantId && ctx.tenantId !== tenantId) return forbidden()`
- Response shape: `{ success: true, data }` or `{ success: false, error }`
- Soft delete: set `isActive: false`, not hard delete
- Role check for sensitive ops: `ensureRole(ctx.role, ["admin", "checker"])`

### Step 5: Frontend page

**For settings pages:** `src/app/(app)/settings/tenants/[id]/my-feature/page.tsx`
**For app pages:** `src/app/(app)/my-feature/page.tsx`

Follow the departments settings page pattern:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type MyItem = {
  id: string;
  name: string;
  // other fields...
};

export default function MyFeaturePage() {
  const params = useParams();
  // For settings pages, use params.id; for app pages, use getWorkspaceTenantId()
  const tenantId = (params?.id as string) || getWorkspaceTenantId();

  const [rows, setRows] = useState<MyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/tenants/${tenantId}/my-feature`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setRows(json.data);
        else setMsg(json.error || "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  // Create
  async function handleCreate() {
    const res = await fetch(`/api/tenants/${tenantId}/my-feature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (json.success) {
      setRows((prev) => [...prev, json.data]);
      setName("");
      setMsg("Created");
    } else {
      setMsg(json.error || "Failed");
    }
  }

  // Update
  async function handleUpdate() {
    const res = await fetch(`/api/tenants/${tenantId}/my-feature`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, name }),
    });
    const json = await res.json();
    if (json.success) {
      setRows((prev) => prev.map((r) => (r.id === editId ? json.data : r)));
      setEditId(null);
      setName("");
      setMsg("Updated");
    } else {
      setMsg(json.error || "Failed");
    }
  }

  // Delete
  async function handleDelete(id: string) {
    const res = await fetch(`/api/tenants/${tenantId}/my-feature`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (json.success) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setMsg("Deleted");
    }
  }

  if (loading) return <p className="p-6 text-slate-500">Loading...</p>;

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold mb-4">My Feature</h1>
      {msg && <p className="text-sm text-blue-600 mb-2">{msg}</p>}

      {/* Form */}
      <div className="flex gap-2 mb-4">
        <input
          className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="bg-slate-800 text-white px-4 py-1.5 rounded text-sm"
          onClick={editId ? handleUpdate : handleCreate}
        >
          {editId ? "Save" : "Add"}
        </button>
        {editId && (
          <button
            className="text-sm text-slate-500"
            onClick={() => { setEditId(null); setName(""); }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2">Name</th>
            <th className="text-right py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-2">{row.name}</td>
              <td className="py-2 text-right space-x-2">
                <button
                  className="text-blue-600 text-xs"
                  onClick={() => { setEditId(row.id); setName(row.name); }}
                >
                  Edit
                </button>
                <button
                  className="text-red-600 text-xs"
                  onClick={() => handleDelete(row.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**UI conventions:**
- `"use client"` at top for interactive pages
- Tailwind: `slate-*` color palette, compact controls, `text-sm`
- Loading state: `text-slate-500` message
- Error/success: `text-blue-600` for messages
- Tables: `border-collapse`, `border-slate-200` headers, `border-slate-100` rows
- Buttons: `bg-slate-800 text-white` primary, `text-blue-600` secondary, `text-red-600` destructive

### Step 6: Wire into navigation (if app-level page)

**File:** `src/app/(app)/layout.tsx`

Add to the sidebar nav items array:

```typescript
{ href: "/my-feature", label: "My Feature", icon: SomeIcon }
```

**For settings pages:** No sidebar change needed — settings pages are accessed via the tenant settings navigation which already exists.

### Step 7: Add background job (if async processing needed)

Follow **aicount-inngest-jobs** skill. Quick checklist:
1. Create function in `src/lib/inngest/functions/`
2. Register in `src/app/api/inngest/route.ts`
3. Send event from API route: `await inngest.send({ name: "entity/action", data: { ... } })`

### Step 8: Add audit logging (if accountable action)

```typescript
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

await db.insert(auditLogs).values({
  tenantId,
  userId: ctx.userId,
  action: "my_feature.created",     // format: entity.action
  entityType: "my_feature",
  entityId: newRow.id,
  metadata: { name: newRow.name },   // free-form context
  ipAddress: ctx.ipAddress,
});
```

## Feature type recipes

### New settings page (CRUD master data)

Simplest pattern. Follow steps 1-5 above with:
- Table with `isActive` soft-delete
- API route under `src/app/api/tenants/[id]/`
- Page under `src/app/(app)/settings/tenants/[id]/`
- No sidebar change, no Inngest job

**Examples:** departments, vendors, customers, products, COA

### New report

No schema change usually needed — aggregate existing data:
1. API route: `src/app/api/tenants/[id]/reports/my-report/route.ts`
2. Query: aggregate from documents + journal_lines, filter by tenant + date range
3. Page: `src/app/(app)/settings/tenants/[id]/my-report/page.tsx` or standalone
4. Consider export to CSV/Excel via `xlsx` package

### New document workflow step

Extends the document processing pipeline:
1. Service: `src/lib/services/my-step.ts` — pure logic
2. Inngest: add step to `processDocument` in `process-document.ts`
3. API: may need new route for manual trigger (e.g., `/api/documents/[id]/my-action`)
4. Status: may need new `documentStatusEnum` value

### New export format

1. Service: `src/lib/services/my-export.ts` — generates file content
2. API: route under `src/app/api/export/`
3. UI: add option to export page `src/app/(app)/export/page.tsx`
4. Audit: log via `exportTemplateSelections` table

## File creation checklist

| Layer | File to create/edit | Required? |
|-------|---------------------|-----------|
| Schema | `src/lib/db/schema.ts` | If new data |
| Relations | `src/lib/db/relations.ts` | If new table |
| Types | `src/types/domain.ts` | If new table |
| RLS | `supabase/migrations/NNNN_*.sql` | If new table |
| Queries | `src/lib/db/queries/my-feature.ts` | Optional |
| Service | `src/lib/services/my-feature.ts` | If complex logic |
| API route | `src/app/api/tenants/[id]/my-feature/route.ts` | Yes |
| Page | `src/app/(app)/settings/tenants/[id]/my-feature/page.tsx` | Yes |
| Layout | `src/app/(app)/layout.tsx` | Only for app-level nav |
| Inngest | `src/lib/inngest/functions/my-job.ts` | If async |
| Inngest route | `src/app/api/inngest/route.ts` | If new Inngest function |

## Validation before shipping

```bash
npm run lint          # Fix what you introduced
npx tsc --noEmit      # Type check
npm run build         # Full build
npm run db:health     # Schema + RLS OK
```

## Common mistakes to avoid

- Forgetting `tenantId` filter in queries (even with RLS, explicit filtering required)
- Unique indexes not scoped to tenant (e.g., `code` alone instead of `(tenantId, code)`)
- Missing RLS policy on new table → data leak across tenants
- Hard-coding tenant IDs or user IDs
- Not checking `getRequestContext()` for null (skipping auth)
- Using `isActive` for transactional data (use `deletedAt` or status enum instead)
- Forgetting `updatedAt: new Date()` on UPDATE operations
- Not returning `{ success: false, error }` on API failures
