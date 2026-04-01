# Phase 6B: AI Foundation

**Date:** 2026-04-01
**Status:** Design approved
**Depends on:** Phase 6A (Extraction Accuracy — complete)
**Feeds into:** Phase 6C (Inline Suggestions), 6D (Chat + Learning Engine)

## Problem Statement

Phase 6A shipped a three-tier AI extraction pipeline (Haiku → Sonnet → Vision) with learned rules. However:

1. **No cost visibility** — AI costs are buried in `documents.ocrRaw` JSONB. Tenant admins can't see how much they're spending. Product owner has no cross-tenant cost overview.
2. **No rule management** — Learned extraction rules accumulate automatically but nobody can review, edit, or delete bad rules. A mis-learned rule silently degrades extraction quality.
3. **No backoffice** — The product owner has no admin area to monitor platform health, per-tenant usage, or manage the AI system.
4. **No budget controls** — Every tenant gets unlimited AI calls with no spending limits or alerts.

## Solution Overview

| Area | What | Who |
|------|------|-----|
| Tenant Settings | Simple AI usage widget (3 StatCards + budget bar) | Tenant admins |
| Backoffice Analytics | Full dashboard — cross-tenant costs, charts, per-tenant table | Superadmin only |
| Backoffice Rules | View/edit/graduate/delete extraction rules across all tenants | Superadmin only |
| Backoffice Access | New `/backoffice` route area, gated by `isSuperadmin` on profiles | Superadmin only |
| Pipeline Update | Write to `ai_usage_logs` table on every AI API call | System |

---

## Database Schema

### New Table: `ai_usage_logs`

Tracks every AI API call for queryable cost analytics. One row per call (extraction = 1-3 rows per document depending on tier escalation).

```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID REFERENCES documents(id),         -- nullable: future chat/suggestion calls have no document
  provider TEXT NOT NULL,                              -- "anthropic", "google"
  model TEXT NOT NULL,                                 -- "claude-haiku-4-5", "claude-sonnet-4-6", etc.
  feature TEXT NOT NULL DEFAULT 'extraction',           -- "extraction", "suggestion", "chat"
  tier INTEGER,                                        -- 1/2/3 for extraction, NULL for other features
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  metadata JSONB,                                      -- escalation reasons, validation results, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_tenant_date ON ai_usage_logs(tenant_id, created_at);
CREATE INDEX idx_ai_usage_logs_feature_date ON ai_usage_logs(feature, created_at);
```

**Design decisions:**
- `feature` column future-proofs for Phase 6C (suggestions) and 6D (chat) — they write to the same table
- `provider` column future-proofs for provider abstraction — currently only "anthropic" and "google" are written
- `document_id` is nullable because 6C/6D features may not be document-scoped
- `metadata` JSONB stores tier-specific debug info (escalation reasons, validation failures) — keeps the table flexible without schema changes
- No monthly rollup table — aggregate queries on this table with date range filters are fast enough for the expected volume (thousands of rows/month, not millions)

### Schema Changes to Existing Tables

```sql
-- Superadmin flag (platform-level, independent of tenant roles)
ALTER TABLE profiles ADD COLUMN is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

-- Budget controls per tenant
ALTER TABLE tenants ADD COLUMN monthly_budget_usd NUMERIC(10,2);          -- NULL = no limit
ALTER TABLE tenants ADD COLUMN budget_alert_threshold NUMERIC(3,2) DEFAULT 0.80;  -- alert at 80%
```

**Superadmin notes:**
- `isSuperadmin` is separate from the `tenant_assignments` role system (maker/checker/admin)
- A user can be superadmin AND have normal tenant roles simultaneously
- Set via direct DB update only — no UI to grant superadmin (security by design for MVP)
- Example: `UPDATE profiles SET is_superadmin = true WHERE id = '<user-id>';`

---

## Auth: Superadmin Access

### proxy.ts Changes

1. After resolving the user from Supabase session, query `profiles.is_superadmin`
2. Set `x-is-superadmin: "true"` or `"false"` header on the proxied request
3. For `/backoffice/*` routes: if not superadmin, return 403

### Request Context

Extend `getRequestContext()` to include `isSuperadmin: boolean` from the header.

### Sidebar

The main app sidebar conditionally renders a "Backoffice" link (with a shield/settings icon) when the user is superadmin. Clicking navigates to `/backoffice`.

---

## Pipeline Update: Usage Logging

### Where to Write

In `src/lib/services/extraction/pipeline.ts`, after each tier call returns:

```
Tier 1 (Haiku) completes → write ai_usage_logs row
  ↓ escalates?
Tier 2 (Sonnet) completes → write ai_usage_logs row
  ↓ escalates?
Tier 3 (Vision) completes → write ai_usage_logs row
```

Also write a row for the Google Vision OCR call (provider: "google", feature: "extraction", tier: null).

### What to Write

Each row captures:
- `tenantId` from the document
- `documentId` from the document
- `provider`: "anthropic" or "google"
- `model`: exact model string used
- `feature`: "extraction"
- `tier`: 1, 2, or 3 (null for Google Vision)
- `inputTokens`, `outputTokens`: from Claude API response `usage` field
- `costUsd`: calculated from token counts × model pricing
- `metadata`: `{ escalationReasons, validationResults, tierResult }` (optional debug context)

### Backward Compatibility

Existing `ocrRaw.extraction_debug` data stays unchanged. The new `ai_usage_logs` table is additive — old documents without usage logs simply won't appear in analytics (which is fine, they were processed before this feature existed).

---

## Tenant Settings: AI Usage Tab

### Location

New Settings sidebar item "AI Usage" under the **Accounting** group, below existing items (Templates, Period Locks, Bank Recon, Tax Reports, Report Retention).

Route: `/settings/accounting/ai-usage`

### Layout (Option A: 3 StatCards + Budget Bar)

**StatCards row** (grid-cols-3, matching dashboard pattern):

| Card | Value | Trend |
|------|-------|-------|
| Documents Processed | Count this month | "This month" (neutral) |
| Total AI Cost | Sum of costUsd this month | % change vs last month |
| Avg Cost / Document | totalCost / docCount | "Blended across tiers" (neutral) |

**Budget progress bar** (below cards):
- Shows `$spent / $budget` with progress bar
- Color: green (<80%), amber (80-99%), red (100%+)
- Status text: "18% used — on track" / "82% used — approaching limit" / "Over budget"
- Hidden entirely if tenant has no budget set (monthlyBudgetUsd is NULL)
- "Set budget" link when no budget exists

**Tier breakdown footer** (subtle, below budget bar):
- Three inline items: Tier 1 (Haiku): N docs, Tier 2 (Sonnet): N docs, Tier 3 (Vision): N docs
- Color-coded dots: green (T1), blue (T2), amber (T3)

### Data Query

```sql
SELECT
  COUNT(*) as doc_count,
  SUM(cost_usd) as total_cost,
  SUM(CASE WHEN tier = 1 THEN 1 ELSE 0 END) as tier1_count,
  SUM(CASE WHEN tier = 2 THEN 1 ELSE 0 END) as tier2_count,
  SUM(CASE WHEN tier = 3 THEN 1 ELSE 0 END) as tier3_count
FROM ai_usage_logs
WHERE tenant_id = $1
  AND feature = 'extraction'
  AND created_at >= date_trunc('month', NOW())
  AND created_at < date_trunc('month', NOW()) + interval '1 month';
```

Note: `doc_count` here is the count of usage log rows, not unique documents. For unique document count, use `COUNT(DISTINCT document_id)`.

### Budget Editing

Inline edit: click the budget value → input field appears → save. PATCH `/api/tenants/[id]` with `monthlyBudgetUsd` and `budgetAlertThreshold`.

---

## Backoffice: Route Structure

```
src/app/(backoffice)/
  layout.tsx                    ← Backoffice shell (sidebar + superadmin guard)
  backoffice/
    page.tsx                    ← Redirects to /backoffice/overview
    overview/
      page.tsx                  ← AI Overview dashboard
    rules/
      page.tsx                  ← Extraction Rules management
    tenants/
      page.tsx                  ← Tenant list (basic)
```

### Backoffice Layout

- Dedicated sidebar (separate from main app sidebar)
- Brand: "AICount" with red "BACKOFFICE" badge
- Nav groups:
  - **Analytics**: AI Overview, Cost Analysis (future)
  - **Management**: Extraction Rules, Tenants
- Footer: "Back to App" link → navigates to `/dashboard`
- Superadmin guard in layout: if not superadmin, redirect to `/dashboard`

---

## Backoffice: AI Overview Dashboard

### StatCards (grid-cols-4)

| Card | Value | Trend |
|------|-------|-------|
| Total AI Spend | Sum across all tenants this month | % vs last month |
| Total Documents | Count of documents processed | % vs last month |
| Active Tenants | Tenants with ≥1 extraction this month | Change vs last month |
| Avg Cost / Doc | Blended average | % change (down = improving) |

### Daily Cost Trend Chart (Recharts LineChart)

- X-axis: days of current month
- Y-axis: cumulative AI cost ($)
- Line: cumulative daily spend
- Dashed reference line: budget pace (total platform budget / days in month × day number)
- Tooltip: date, daily cost, cumulative cost

### Tier Distribution Chart (Recharts PieChart — donut)

- Three segments: Tier 1 (green #059669), Tier 2 (blue #2563EB), Tier 3 (amber #F59E0B)
- Center: total document count
- Legend with percentages

### Per-Tenant Usage Table

- Columns: Tenant, Documents, AI Cost, Avg/Doc, Budget (mini progress bar), T1 %
- Sortable by any column
- Search by tenant name
- Budget bar: green (<80%), amber (80-99%), red (100%+), "No budget" text when unset
- Row click: future expansion to tenant detail page
- Server-side pagination

### Period Picker

- Month selector dropdown (default: current month)
- All data filters by selected month

---

## Backoffice: Extraction Rules

### StatCards (grid-cols-4)

| Card | Value | Subtitle |
|------|-------|----------|
| Total Rules | Count all | "Across N tenants" |
| Graduated | Count where is_graduated=true | "Deterministic (no AI)" |
| Prompt-Injected | Count where is_graduated=false AND confidence≥0.50 | "Active as AI hints" |
| Low Confidence | Count where confidence<0.50 | "Below 0.50, may need review" |

### Filter Bar

- Tenant dropdown (All Tenants + list of tenants)
- Status dropdown: All, Graduated, Prompt-Injected, Low Confidence
- Rule Type dropdown: All, issuer_hint, field_pattern, format_rule
- Free-text search (searches rule_text, trigger_value, field_name)

### DataTable with Expandable Rows

**Collapsed row columns:**
| Column | Content |
|--------|---------|
| Expand arrow | ▶ |
| Tenant | Tenant name (italic "Global" for tenant_id=NULL rules) |
| Trigger | trigger_value (monospace, e.g., tax ID) |
| Field | field_name |
| Type | Badge: issuer_hint / field_pattern / format_rule |
| Confidence | Mini progress bar + numeric value (green ≥0.80, blue ≥0.50, amber <0.50) |
| Samples | sample_count |
| Status | Badge: Graduated (green) / Prompt (blue) / Low (amber) |

**Expanded row detail:**
- Full rule text
- Deterministic value (if graduated)
- Created date, last updated date
- Action buttons:
  - **Edit Rule** — opens modal to edit rule_text and deterministic_value
  - **Graduate** (shown when not graduated, confidence ≥0.80) — manually promote to deterministic
  - **Demote to Prompt** (shown when graduated) — set is_graduated=false
  - **Delete** — confirmation dialog, then soft-delete (or hard-delete for low-confidence rules)

### Server-Side Pagination

- Default 20 rules per page
- Pagination component at bottom (matching existing Pagination component)

---

## Backoffice: Tenants (Basic)

Simple read-only list for MVP. Future expansion point for tenant management.

### Table Columns

| Column | Content |
|--------|---------|
| Name | Tenant name |
| Tax ID | Tenant tax ID |
| Members | Count from tenant_assignments |
| Documents | Total document count |
| AI Spend (month) | Sum from ai_usage_logs this month |
| Budget | Monthly budget or "Not set" |
| Created | Tenant creation date |

No actions for MVP — view only.

---

## API Routes

### New Routes

```
GET  /api/backoffice/analytics          ← Overview stats + chart data
GET  /api/backoffice/analytics/tenants  ← Per-tenant usage table (paginated, searchable)
GET  /api/backoffice/rules              ← Rules list (paginated, filterable)
PATCH /api/backoffice/rules/[id]        ← Update rule (edit, graduate, demote)
DELETE /api/backoffice/rules/[id]       ← Delete rule
GET  /api/backoffice/tenants            ← Tenant list
GET  /api/settings/ai-usage             ← Tenant's own usage stats (scoped by x-tenant-id)
```

### Auth Pattern

All `/api/backoffice/*` routes:
```typescript
const ctx = getRequestContext(request);
if (!ctx) return unauthorized();
if (!ctx.isSuperadmin) return forbidden("Superadmin access required");
```

Tenant settings route (`/api/settings/ai-usage`):
```typescript
const ctx = getRequestContext(request);
if (!ctx) return unauthorized();
// Uses ctx.tenantId — scoped to the user's current tenant
```

---

## File Structure

```
src/
  app/
    (backoffice)/
      layout.tsx                          ← Backoffice shell + superadmin guard
      backoffice/
        page.tsx                          ← Redirect to /backoffice/overview
        overview/
          page.tsx                        ← AI Overview dashboard
        rules/
          page.tsx                        ← Extraction Rules management
        tenants/
          page.tsx                        ← Tenant list
    (app)/
      settings/
        accounting/
          ai-usage/
            page.tsx                      ← Tenant AI Usage widget
    api/
      backoffice/
        analytics/
          route.ts                        ← Overview analytics API
          tenants/
            route.ts                      ← Per-tenant usage API
        rules/
          route.ts                        ← Rules list API
          [id]/
            route.ts                      ← Rule update/delete API
        tenants/
          route.ts                        ← Tenant list API
      settings/
        ai-usage/
          route.ts                        ← Tenant's own AI usage API
  components/
    backoffice-sidebar.tsx                ← Backoffice navigation sidebar
    budget-progress-bar.tsx               ← Reusable budget bar (used in settings + backoffice)
    confidence-bar.tsx                    ← Already exists, may reuse or extend
    tier-distribution-chart.tsx           ← Donut chart component
    daily-cost-chart.tsx                  ← Line chart component
  lib/
    db/
      schema.ts                           ← ADD: ai_usage_logs, profile + tenant columns
      queries/
        ai-usage.ts                       ← Usage aggregation queries
    services/
      extraction/
        pipeline.ts                       ← UPDATE: write to ai_usage_logs after each tier
    hooks/
      use-ai-usage.ts                     ← React Query hook for tenant usage data
      use-backoffice.ts                   ← React Query hooks for backoffice data
```

---

## Success Criteria

### Database (must have)
- [ ] `ai_usage_logs` table created with indexes
- [ ] `profiles.is_superadmin` column added
- [ ] `tenants.monthly_budget_usd` and `budget_alert_threshold` columns added
- [ ] Migration generated via `drizzle-kit generate`

### Pipeline (must have)
- [ ] Every AI API call (Google Vision + Claude tiers) writes a row to `ai_usage_logs`
- [ ] Token counts and cost accurately recorded
- [ ] Existing `ocrRaw` debug data unchanged (backward compatible)

### Auth (must have)
- [ ] `proxy.ts` reads `is_superadmin` and sets header
- [ ] `/backoffice/*` routes return 403 for non-superadmin users
- [ ] `getRequestContext()` includes `isSuperadmin`

### Tenant Settings (must have)
- [ ] "AI Usage" nav item in Settings sidebar
- [ ] 3 StatCards showing current month data
- [ ] Budget progress bar with color states (green/amber/red)
- [ ] Tier breakdown footer
- [ ] Budget inline editing

### Backoffice: AI Overview (must have)
- [ ] Dedicated backoffice sidebar with navigation
- [ ] 4 StatCards with cross-tenant aggregates
- [ ] Daily cost trend line chart (Recharts)
- [ ] Tier distribution donut chart (Recharts)
- [ ] Per-tenant usage table with search, sort, budget bars
- [ ] Period picker (month selector)

### Backoffice: Extraction Rules (must have)
- [ ] 4 StatCards (total, graduated, prompt, low confidence)
- [ ] Filter bar (tenant, status, type, search)
- [ ] DataTable with expandable rows
- [ ] Actions: Edit, Graduate, Demote, Delete
- [ ] Server-side pagination

### Backoffice: Tenants (must have)
- [ ] Simple read-only tenant list with key metrics

---

## Out of Scope — Deferred Items

These items were explicitly discussed and deferred. They are NOT forgotten — they are intentionally scheduled for later phases or future iterations. Each entry includes context for why it was deferred and what's needed to pick it up.

### 1. AI Provider Abstraction Layer → Future (pre-6D)

**What:** An abstract `AIProvider` interface that makes AI providers swappable (Claude, GPT, Gemini, local models, etc.). Currently Claude/Anthropic is hardcoded in all three tier files.

**Why deferred:** MVP staging doesn't need multiple providers. Only one provider (Anthropic) is in use. Adding abstraction now would be premature complexity.

**Schema readiness:** `ai_usage_logs.provider` column already exists and records "anthropic" or "google" per call. This column is the hook point — when abstraction is built, it naturally populates.

**What's needed to pick up:**
- Define `AIProvider` interface in `src/lib/services/ai/provider.ts` with methods: `chat()`, `chatWithVision()`, `embeddings()` (for 6D)
- Create `AnthropicProvider` implementing the interface (extract from current tier files)
- Factory function to get provider by name from config
- Update extraction tiers to use the factory instead of direct Anthropic SDK
- Consider: provider selection per feature (extraction vs chat vs suggestions may prefer different providers)

**Files to change:** `src/lib/services/extraction/tiers/tier1-haiku.ts`, `tier2-sonnet.ts`, `tier3-vision.ts`, `src/lib/services/ocr.ts`

**Reference:** Memory file `project_ai_assistant.md` describes the planned `AIProvider` interface design.

### 2. Subscription Tier Integration → Future

**What:** Tie AI features to subscription plans. Different tiers get different limits (e.g., Free: 50 docs/month, Pro: 500, Enterprise: unlimited). Enforce limits at extraction time.

**Why deferred:** No subscription/billing system exists yet. Building tier enforcement without a billing backend would be dead code. The `monthlyBudgetUsd` field provides soft cost control for now.

**Schema readiness:** `tenants` table could receive `subscription_tier` and `subscription_expires_at` columns when billing is added. `ai_usage_logs` provides the query surface for enforcement (`COUNT WHERE tenant_id = X AND month = Y`).

**What's needed to pick up:**
- Design subscription tiers (Free/Pro/Enterprise or custom)
- Add `subscription_tier`, `subscription_started_at`, `subscription_expires_at` to tenants
- Create `subscription_limits` config (docs/month, tiers allowed, features enabled)
- Add pre-extraction check: query `ai_usage_logs` count for current month, compare to tier limit
- UI: upgrade prompts when limit approached, hard block with upgrade CTA when exceeded
- Billing integration (Stripe or similar)

### 3. Budget Hard-Stop → Future

**What:** When a tenant exceeds their monthly budget, block further AI extraction calls instead of just showing a warning.

**Why deferred:** For MVP, soft alerts (amber/red budget bar) are sufficient. Hard-stopping could break a tenant's workflow mid-month with no easy recovery. Need to design the UX carefully (grace period? admin override? manual extraction still works?).

**What's needed to pick up:**
- Pre-extraction budget check in pipeline.ts
- Decide policy: hard block vs soft block (allow with warning) vs grace period
- Fallback UX: what does the user see when blocked? Can they still upload and manually enter?
- Admin override mechanism (superadmin can lift the block)
- Notification system: email alert when approaching limit, email when blocked

### 4. Tenant Self-Service Rule Management → Future (post-growth)

**What:** Allow tenant admins to view and manage their own extraction rules in Settings, not just the backoffice superadmin.

**Why deferred:** Rules are a power-user concept. Exposing them to all tenant admins before the rule system is battle-tested could cause confusion or accidental rule deletion. Let the product owner curate rules via backoffice first, then open self-service when rules are stable.

**What's needed to pick up:**
- New Settings page: `/settings/accounting/extraction-rules`
- Scoped API: `GET /api/settings/extraction-rules` (filtered by `ctx.tenantId`)
- Read-only initially, then add edit/delete with appropriate guardrails
- Consider: show rules as "AI learned that..." in plain language, not raw rule_text
- Permission: only tenant admins (not makers/checkers)

### 5. Cost Analysis Deep-Dive Page → Future

**What:** A second backoffice analytics page with deeper cost breakdowns — cost per model over time, cost per feature (extraction vs suggestion vs chat), token efficiency trends, anomaly detection.

**Why deferred:** The AI Overview dashboard covers MVP needs. Deeper analytics become valuable once there's more historical data and multiple AI features (6C, 6D) generating usage.

**What's needed to pick up:**
- Route: `/backoffice/cost-analysis`
- Already stubbed in sidebar nav ("Cost Analysis" item, currently dimmed)
- Charts: cost breakdown by model, cost breakdown by feature, token efficiency (output/input ratio), daily anomaly highlights
- Date range picker (not just month — custom ranges)
- Export to CSV

### 6. Cross-Tenant Rule Insights → Phase 6D

**What:** Aggregate anonymized rules across tenants to discover universal patterns. Show "global insights" in the backoffice — e.g., "12 tenants have learned the same date format rule for issuer X."

**Why deferred:** Part of Phase 6D's cross-tenant learning engine. Requires privacy framework and anonymization.

**Prerequisite:** `ai_extraction_rules.tenant_id` nullable design already supports global rules. The backoffice rules page already shows global rules separately.

---

## Future Expansion Points

These are architectural hooks built into Phase 6B that will make future phases easier:

| Hook | Column/Design | Used By |
|------|---------------|---------|
| `ai_usage_logs.feature` | "extraction" now; "suggestion", "chat" later | Phase 6C, 6D |
| `ai_usage_logs.provider` | "anthropic", "google" now; any provider later | Provider abstraction |
| `ai_usage_logs.document_id` nullable | Extraction always has docId; chat/suggestions may not | Phase 6D |
| `tenants.monthly_budget_usd` | Soft control now; hard enforcement later | Subscription tiers |
| Backoffice sidebar "Cost Analysis" | Stubbed as dimmed nav item | Cost deep-dive page |
| Backoffice sidebar "Tenants" | Basic list now; full tenant management later | Admin CRUD |
| `profiles.is_superadmin` | Boolean flag; could become `platform_role` enum later | Platform roles |

---

## Migration Plan

| Step | Action | Risk |
|------|--------|------|
| 1 | Add new DB columns + `ai_usage_logs` table | None — additive |
| 2 | Update extraction pipeline to write usage logs | Low — additive, existing flow unchanged |
| 3 | Add `isSuperadmin` to proxy.ts + request context | Low — new header, no existing behavior changed |
| 4 | Build tenant Settings AI Usage page | None — new page |
| 5 | Build backoffice layout + overview dashboard | None — new route area |
| 6 | Build backoffice rules management | None — new page, reads existing table |
| 7 | Build backoffice tenants list | None — new page |

All changes are additive. No existing functionality is modified beyond the extraction pipeline (which gains a non-blocking usage log write).
