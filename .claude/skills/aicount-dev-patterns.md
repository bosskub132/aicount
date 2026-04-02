---
name: aicount-dev-patterns
description: >-
  Development patterns extracted from 200 commits of aicount git history.
  Covers commit conventions, file co-change patterns, common bug fix categories,
  phase-driven development workflow, and UI component iteration patterns.
  Use when planning work, estimating change scope, or following project conventions.
version: 1.0.0
source: local-git-analysis
analyzed_commits: 200
---

# AICount Development Patterns

## Commit Conventions

This project uses **conventional commits** strictly:

| Type | Count | Usage |
|------|-------|-------|
| `feat:` | 81 (40%) | New features, UI additions, API endpoints |
| `fix:` | 54 (27%) | Bug fixes, UI corrections, error handling |
| `docs:` | 16 (8%) | Specs, plans, CLAUDE.md updates |
| `refactor:` | 12 (6%) | Restyling pages, restructuring code |
| `fix(security):` | 5 (3%) | Security-specific fixes |
| `chore:` | 3 (2%) | Maintenance, cleanup |

### Commit message style

- **feat:** descriptive noun phrase — `feat: add extraction pipeline orchestrator with three-tier escalation`
- **fix:** explains what was wrong — `fix: upload poll uses doc.status instead of nonexistent ocrStatus`
- **refactor:** states what changed visually — `refactor: restyle departments settings page with DataTable, Modal, and FileImport`
- **docs:** states the artifact — `docs: add Phase 6A extraction accuracy design spec`
- Scoped types used occasionally: `feat(queries):`, `fix(schema):`, `feat(components):`

## Phase-Driven Development

Work is organized in numbered **phases**, each with a spec → plan → implementation flow:

1. **Spec first** — `docs: add Phase {N} {name} design spec`
2. **Plan second** — `docs: add Phase {N} {name} implementation plan`
3. **Schema/migration** — `feat: add {tables} for Phase {N}`
4. **Implementation** — multiple `feat:` commits building up the feature
5. **Bug fixes** — cluster of `fix:` commits polishing the phase
6. **CLAUDE.md update** — `docs: update CLAUDE.md with Phase {N} learnings`

Phases observed: Phase 1 (components), Phase 2 (rework), Phase 3 (accounting), Phase 4 (reports/PDF), Phase 5 (settings/polish), Phase 6A (extraction accuracy).

## File Co-Change Patterns

Files that **always change together** — if you touch one, you likely need the other:

### Master Data Pages (always change as a group)
- `settings/masterdata/vendors/page.tsx`
- `settings/masterdata/customers/page.tsx`
- `settings/masterdata/departments/page.tsx`
- `settings/masterdata/products/page.tsx`
- `settings/masterdata/coa/page.tsx`
- Their corresponding API routes in `api/tenants/[id]/{resource}/route.ts`

### Onboarding Pages (always change as a group)
- `onboarding/chart-of-accounts/page.tsx`
- `onboarding/vendors-customers/page.tsx`
- `onboarding/departments/page.tsx`
- `onboarding/team/page.tsx`

### Document Viewer Pair
- `components/document-image-viewer.tsx` ↔ `components/document-side-panel.tsx`

### Schema + Migration
- `src/lib/db/schema.ts` ↔ `supabase/migrations/meta/_journal.json`

### Package Pair
- `package.json` ↔ `package-lock.json`

## Most Changed Files (hotspots)

These files accumulate the most changes and need careful attention:

1. **`src/lib/db/schema.ts`** (10 changes) — central schema, high-risk
2. **`src/components/data-table.tsx`** (8 changes) — heavily iterated generic component
3. **`src/components/modal.tsx`** (6 changes) — overflow/positioning fixes
4. **`src/components/select.tsx`** (4 changes) — dropdown positioning issues
5. **`src/app/globals.css`** (4 changes) — theme token additions

## Common Bug Fix Categories

Recurring fix patterns extracted from commit messages:

### 1. Component Overflow/Positioning (most frequent)
- Modal centering, Select dropdown overflow, tooltip positioning
- Pattern: `fix: {component} overflow/positioning` — always test in modal context

### 2. Hydration Mismatches
- Server vs client state differences (e.g., `getWorkspaceTenantId` returning `""` on server)
- Pattern: guard server-side values to match client defaults

### 3. React Hook Dependencies
- `useCallback` with `toast` causing infinite loops
- Pattern: exclude store hooks from dependency arrays

### 4. Drizzle/Postgres Errors
- Duplicate key detection requires checking `error.cause.code === "23505"`, not `error.message`
- Pattern: always wrap DB errors with user-friendly messages

### 5. Tenant Scoping
- Missing `tenantId` in fetch headers, middleware role resolution
- Pattern: every API call needs `x-tenant-id` header

## UI Iteration Pattern

New UI features follow a consistent 3-commit pattern:

1. **Initial implementation** — `feat: add {feature} with {components}`
2. **Quick fix** — `fix: {visual/behavioral issue}` (same day)
3. **Polish fix** — `fix: {edge case or styling}` (same day or next)

When implementing UI, expect 2-3 follow-up fixes for positioning, overflow, and edge cases.

## Restyling Pattern

Existing pages get restyled to match the design system:

```
refactor: restyle {page name} with DataTable, Modal, and {design system components}
```

Restyling always involves:
- Replacing custom tables with `DataTable`
- Adding `Modal` for create/edit flows
- Using `FileImport` for batch import
- Adding sorting and pagination
- Wiring up `useToast` for feedback

## Architecture Hotspots

### Most Active Directories
| Directory | Changes | Purpose |
|-----------|---------|---------|
| `src/components/` | 69 | Shared UI components |
| `src/lib/hooks/` | 31 | React Query hooks |
| `src/lib/db/queries/` | 31 | Database query functions |
| `src/lib/services/` | 21 | Business logic |
| `src/lib/db/` | 12 | Schema definitions |

### Development Velocity
- Average ~30-60 commits per active day
- Most productive days: 62 commits (2026-03-30), 54 commits (2026-03-23)
- Features and fixes interleaved within same day (build-test-fix cycle)
