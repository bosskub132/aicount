---
name: aicount-db-schema
description: >-
  Guides adding new Drizzle tables, enums, relations, RLS policies, and running
  migrations in the aicount multi-tenant Supabase project. Use when creating or
  modifying database schema, adding tenant-scoped tables, writing RLS policies,
  or running drizzle-kit migrations.
user_invocable: true
---

# aicount — database & schema

## When to use this skill

Read this before:
- Adding a **new table** or **enum** to the schema
- Modifying columns, indexes, or constraints on existing tables
- Writing or updating **RLS policies** for tenant isolation
- Adding **relations** between tables
- Running **drizzle-kit** migrations to Supabase
- Adding **query helpers** in `src/lib/db/queries/`

## Repo map (where DB work lives)

| File | Role |
|------|------|
| `src/lib/db/schema.ts` | All Drizzle table & enum definitions (~500 lines) |
| `src/lib/db/relations.ts` | Drizzle relation definitions (one-to-many, one-to-one) |
| `src/lib/db/index.ts` | Postgres connection + Drizzle client export |
| `src/lib/db/queries/` | Reusable query helpers (tenant-filtered) |
| `supabase/migrations/` | SQL migration output (drizzle-kit + manual RLS) |
| `drizzle.config.ts` | Drizzle Kit config (schema path, migration output dir) |

## Adding a new table — step-by-step

### 1. Define the table in `schema.ts`

Follow the existing pattern exactly:

```typescript
import { pgTable, uuid, text, boolean, timestamp, varchar, /* ... */ } from "drizzle-orm/pg-core";

export const myNewTable = pgTable("my_new_table", {
  // PK — always uuid with random default
  id: uuid("id").primaryKey().defaultRandom(),

  // Tenant scope — required for all tenant-scoped tables
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),

  // Business columns
  code: varchar("code", { length: 50 }).notNull(),
  name: text("name").notNull(),
  metadata: jsonb("metadata").default({}),

  // Soft-delete / active flag (prefer isActive for master data, deletedAt for transactional)
  isActive: boolean("is_active").default(true).notNull(),

  // Timestamps — always include both
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Unique constraint scoped to tenant
  uniqueIndex("my_new_table_tenant_code_idx").on(table.tenantId, table.code),
  // Additional indexes for common query patterns
  index("my_new_table_tenant_idx").on(table.tenantId),
]);
```

**Column conventions in this repo:**

| Pattern | Convention |
|---------|-----------|
| Primary key | `uuid("id").primaryKey().defaultRandom()` |
| Tenant FK | `uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" })` |
| User FK | `uuid("user_id").references(() => profiles.id, { onDelete: "cascade" })` |
| Money amounts | `decimal("amount", { precision: 15, scale: 2 })` |
| Exchange rates | `decimal("exchange_rate", { precision: 15, scale: 6 })` |
| Tax ID | `varchar("tax_id", { length: 13 })` |
| Short codes | `varchar("code", { length: 20 })` |
| Date-only fields | `date("document_date")` |
| Timestamps | `timestamp("created_at").defaultNow().notNull()` |
| JSON data | `jsonb("data").default({})` or `.default([])` |
| Enums | Define with `pgEnum` then reference |
| Boolean flags | `boolean("is_active").default(true).notNull()` |
| Year-month periods | `varchar("year_month", { length: 7 })` — "YYYY-MM" format |

### 2. Add an enum (if needed)

Place enums at the top of `schema.ts` with the other enum definitions:

```typescript
export const myStatusEnum = pgEnum("my_status", ["active", "archived", "suspended"]);
```

Then reference in the table: `status: myStatusEnum("status").default("active").notNull()`

### 3. Add relations in `relations.ts`

```typescript
import { relations } from "drizzle-orm";
import { tenants, myNewTable } from "./schema";

// Add to existing tenant relations (append to the many array)
// In the tenants relations block, add: myNewTable

// New table relations
export const myNewTableRelations = relations(myNewTable, ({ one }) => ({
  tenant: one(tenants, {
    fields: [myNewTable.tenantId],
    references: [tenants.id],
  }),
}));
```

**Relation patterns used in this repo:**
- `one()` for FK references (table → parent)
- `many()` for reverse (parent → children), no fields/references needed
- Named relations when a table has multiple FKs to the same parent: `one(documents, { relationName: "poLink", ... })`

### 4. Export the type in `types/domain.ts`

```typescript
import type { InferSelectModel } from "drizzle-orm";
import { myNewTable } from "@/lib/db/schema";

export type MyNewEntity = InferSelectModel<typeof myNewTable>;
```

### 5. Write the RLS policy

Add to `supabase/migrations/` as a new numbered migration file (e.g., `0002_my_new_table_rls.sql`):

**For tenant-scoped tables** (most common):
```sql
-- Enable RLS
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON my_new_table
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid()
    )
  );
```

**For user-scoped tables** (like notifications):
```sql
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_data" ON my_new_table
  FOR ALL
  USING (user_id = auth.uid());
```

**For child tables via parent** (like journal_lines through documents):
```sql
ALTER TABLE my_child_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_via_parent" ON my_child_table
  FOR ALL
  USING (
    parent_id IN (
      SELECT id FROM parent_table WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid()
      )
    )
  );
```

**For read-only audit tables:**
```sql
ALTER TABLE my_audit_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_only" ON my_audit_table
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments WHERE user_id = auth.uid()
    )
  );
```

### 6. Run migrations

```bash
# Generate migration SQL from schema changes
npx drizzle-kit generate

# Push schema directly to database (dev)
npx drizzle-kit push

# Apply RLS policies manually on Supabase
# Copy the SQL from your migration file and run in Supabase SQL Editor
```

**Migration output goes to:** `supabase/migrations/`

### 7. Validate

```bash
# Check all tables exist and RLS is enabled
npm run db:health
```

The health check validates 14+ required tables and RLS status.

## Adding query helpers

Place in `src/lib/db/queries/` following existing patterns:

```typescript
import { db } from "@/lib/db";
import { myNewTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getMyEntities(tenantId: string) {
  return db
    .select()
    .from(myNewTable)
    .where(and(
      eq(myNewTable.tenantId, tenantId),
      eq(myNewTable.isActive, true),
    ));
}

export async function getMyEntityById(id: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(myNewTable)
    .where(and(
      eq(myNewTable.id, id),
      eq(myNewTable.tenantId, tenantId),
    ))
    .limit(1);
  return row ?? null;
}
```

**Query conventions:**
- Always filter by `tenantId` — even with RLS, explicit filtering is required
- Use `and()` to combine conditions
- Use `.limit(1)` with array destructuring `const [row]` for single-record fetches
- Filter `isActive = true` for master data queries
- Return `row ?? null` for optional lookups

## Checklist before shipping schema changes

- [ ] Table has `tenantId` FK (if tenant-scoped) with `onDelete: "cascade"`
- [ ] Unique indexes are **scoped to tenant** (e.g., `(tenantId, code)` not just `(code)`)
- [ ] RLS policy written and tested — user only sees their tenant's data
- [ ] Relations added in `relations.ts` (both directions)
- [ ] Type exported in `types/domain.ts`
- [ ] Query helpers filter by `tenantId` explicitly
- [ ] `npm run db:health` passes after migration
- [ ] Money columns use `decimal(15, 2)`, not float/integer

## Connection details

```typescript
// src/lib/db/index.ts
// Connection: SUPABASE_DB_URL env var
// Pool: max 5 connections, 20s idle timeout, prepare: false
// Schema: all tables + relations imported
```

## Pair with other skills

- **aicount-backend-api**: for API routes that query the new table
- **thai-accounting-workflow**: for accounting-specific schema decisions
- **aicount-new-feature**: for end-to-end feature wiring
