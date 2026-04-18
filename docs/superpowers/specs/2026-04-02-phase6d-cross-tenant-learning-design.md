# Phase 6D: Cross-Tenant Learning Engine

**Date:** 2026-04-02
**Status:** Design approved
**Depends on:** Phase 6C (Inline Suggestions — complete)
**Feeds into:** Future phases (Chat, Industry Segmentation)

## Problem Statement

After Phase 6C, each tenant has a working suggestion system (COA mapping, WHT rates, smart defaults, duplicate detection) powered by their own history. However:

1. **Cold-start problem** — New tenants with zero history get no suggestions until they process enough documents. This makes the first weeks of using AICount feel manual and unassisted.
2. **Wasted collective intelligence** — Hundreds of tenants independently learn the same patterns (e.g., "vendor X always maps to GL 5310"). This knowledge stays siloed per-tenant.
3. **Unnecessary AI costs** — When tenant history has no match, the system falls back to Claude API calls. Many of these could be answered by cross-tenant consensus patterns at zero cost.
4. **No provider abstraction** — Claude/Anthropic is hardcoded in extraction tiers and suggestion providers. Adding a second AI provider requires touching every call site.
5. **No industry/size data** — Tenant metadata doesn't capture industry or company size, limiting analytics and future segmentation capabilities.

## Solution Overview

| Area | What | Who |
|------|------|-----|
| Cross-Tenant Pattern Table | Anonymized statistical patterns aggregated from all tenants | System |
| Pattern Aggregation Engine | Event-driven pattern updates via Inngest on suggestion outcomes | System |
| Provider Integration | Cross-tenant source slots into existing 6C providers | System |
| Onboarding Enrichment | Suggestion pills in COA and Partners onboarding steps | New tenants |
| AI Provider Abstraction | `AIProvider` interface with `AnthropicProvider` implementation | System |
| Backoffice Extension | Pattern stats on dashboard, pattern explorer page | Superadmin |
| Settings | Industry + company size editable in workspace settings | Tenant admins |

### Privacy Model

Pure statistical aggregation — no PII, no raw tenant data, no opt-in needed. The `cross_tenant_patterns` table stores only:
- Normalized trigger keys (e.g., tax ID prefix "0105", not full tax ID)
- Consensus values (e.g., GL account code "5310")
- Aggregate counts (tenant_count, sample_count, accept/dismiss counts)

No tenant can be identified from the pattern data.

---

## Database Schema

### New Table: `cross_tenant_patterns`

Stores pre-computed anonymized patterns aggregated from suggestion outcomes across all tenants.

```sql
CREATE TABLE cross_tenant_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL,              -- 'coa_mapping', 'wht_rate', 'smart_default'
  trigger_key TEXT NOT NULL,               -- normalized key: tax ID prefix, vendor category, etc.
  field_name TEXT NOT NULL,                -- 'glAccountCode', 'whtRate', 'whtIncomeType', 'department', etc.
  suggested_value TEXT NOT NULL,           -- the consensus value
  tenant_count INTEGER NOT NULL DEFAULT 1, -- how many distinct tenants contributed
  sample_count INTEGER NOT NULL DEFAULT 1, -- total observations across all tenants
  accept_count INTEGER NOT NULL DEFAULT 0, -- total accepts
  dismiss_count INTEGER NOT NULL DEFAULT 0,-- total dismissals
  agreement_ratio NUMERIC(3,2) NOT NULL,   -- accept_count / sample_count
  confidence NUMERIC(3,2) NOT NULL,        -- computed score factoring in volume + agreement
  metadata JSONB,                          -- debug: contributing tenant count breakdown, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one pattern per type+trigger+field+value
CREATE UNIQUE INDEX idx_patterns_unique
  ON cross_tenant_patterns(pattern_type, trigger_key, field_name, suggested_value);

-- Query index: find patterns for a given trigger
CREATE INDEX idx_patterns_lookup
  ON cross_tenant_patterns(pattern_type, trigger_key, confidence DESC);
```

### Schema Changes to Existing Tables

```sql
-- Industry + size for analytics and future segmentation
ALTER TABLE tenants ADD COLUMN industry TEXT;           -- 'retail', 'manufacturing', 'services', etc.
ALTER TABLE tenants ADD COLUMN company_size TEXT;       -- 'micro', 'small', 'medium', 'large'
```

**Design decisions:**
- `trigger_key` is a normalized identifier — for COA mapping it's the vendor tax ID prefix (first 4 digits), for WHT it's vendor type + income category. No raw tenant data stored.
- `agreement_ratio` and `confidence` are separate — ratio is raw accept/total, confidence factors in volume (3 tenants at 100% agreement is less confident than 20 tenants at 85%).
- `metadata` JSONB stores debug info (never PII) — e.g., how many tenants contributed, date range of observations.
- No `tenant_id` column — this table is intentionally tenant-agnostic (anonymized aggregation).
- Industry/size on tenants are nullable — existing tenants won't have them until they update settings.
- Duplicate detection is excluded from cross-tenant patterns — duplicates are inherently tenant-scoped.

---

## Pattern Aggregation Engine

### Event Flow

Hooks into the existing 6C learner flow. When a suggestion outcome is processed (form save), an Inngest event fires to update the cross-tenant pattern.

```
User saves form with suggestion outcomes (6C existing flow)
  → learner.ts processes per-tenant outcomes (existing)
  → Emits Inngest event: "suggestion/outcome.processed"
      payload: { patternType, triggerKey, fieldName, suggestedValue, status, tenantId }
  → Inngest handler: upsertCrossTenantPattern()
      - INSERT or UPDATE cross_tenant_patterns row
      - Increment sample_count, accept_count or dismiss_count
      - Recalculate agreement_ratio and confidence
      - Track distinct tenant_count via metadata JSONB
```

### Confidence Calculation

```typescript
function calculateConfidence(
  tenantCount: number,
  sampleCount: number,
  agreementRatio: number
): number {
  // Volume factor: logarithmic scaling, caps at 1.0 around 20+ tenants
  const volumeFactor = Math.min(1.0, Math.log10(tenantCount + 1) / Math.log10(21))

  // Sample factor: more observations = more reliable
  const sampleFactor = Math.min(1.0, sampleCount / 50)

  // Weighted: 50% agreement, 30% volume, 20% samples
  return agreementRatio * 0.5 + volumeFactor * 0.3 + sampleFactor * 0.2
}
```

### Adaptive Thresholds

Thresholds tighten as the platform grows:

```typescript
function getMinThresholds(totalTenants: number) {
  if (totalTenants < 10)  return { minTenants: 3, minAgreement: 0.60 }
  if (totalTenants < 50)  return { minTenants: 5, minAgreement: 0.65 }
  if (totalTenants < 200) return { minTenants: 8, minAgreement: 0.70 }
  return { minTenants: 10, minAgreement: 0.75 }
}
```

### Trigger Key Normalization

Each pattern type has a different trigger key strategy — no raw identifiable data:

| Pattern Type | Trigger Key | Example |
|---|---|---|
| `coa_mapping` | Vendor tax ID prefix (first 4 digits) + document type | `0105:expense_invoice` |
| `wht_rate` | Vendor type + income category | `company:service_fee` |
| `smart_default` | Document type + field combination | `expense_invoice:department` |

### Tenant Count Tracking

The `metadata` JSONB field stores a hash set of contributing tenant IDs (hashed, not raw UUIDs) to accurately compute `tenant_count` on upsert without storing identifiable tenant references:

```typescript
// In upsertCrossTenantPattern:
const tenantHash = crypto.createHash('sha256').update(tenantId).digest('hex').slice(0, 8)
// metadata.tenantHashes is a string array of 8-char hashes
// tenant_count = metadata.tenantHashes.length
// At scale (1000+ tenants), switch to HyperLogLog or bloom filter for memory efficiency
// For MVP with <200 tenants, array of 8-char hashes is ~1.6KB max — negligible
```

### File Structure

```
src/lib/services/learning/
  cross-tenant-engine.ts    -- upsert patterns, confidence calc, threshold logic
  trigger-keys.ts           -- normalize trigger keys per pattern type
  types.ts                  -- CrossTenantPattern interface

src/lib/inngest/functions/
  update-cross-tenant-pattern.ts  -- Inngest handler for suggestion/outcome.processed
```

---

## Suggestion Provider Integration

### Priority Chain

Cross-tenant patterns slot into existing 6C providers between graduated rules and AI fallback:

```
Per suggestion request:
  1. Tenant's own history (existing, highest priority)
  2. Graduated rules (existing)
  3. Cross-tenant patterns (NEW — only if steps 1-2 have no result)
  4. AI model fallback (existing, most expensive)
```

Benefits:
- Tenant's own data always wins
- Cross-tenant fills the cold-start gap
- AI calls are reduced (cost savings)

### Changes to Existing Providers

**`coa-suggester.ts`** — add `fromCrossTenant()`:
```typescript
// After fromHistory returns empty:
const crossTenantMatch = await queryCrossTenantPattern({
  patternType: 'coa_mapping',
  triggerKey: normalizeTriggerKey('coa_mapping', vendorTaxId, docType),
  fieldName: 'glAccountCode',
})
// If match found with sufficient confidence, return it with source: 'cross_tenant'
// Skip AI fallback call — cost savings
```

**`wht-suggester.ts`** — add `fromCrossTenant()`:
```typescript
// After fromHistory returns empty, before vendor-type rule fallback:
const crossTenantMatch = await queryCrossTenantPattern({
  patternType: 'wht_rate',
  triggerKey: normalizeTriggerKey('wht_rate', vendorType, incomeCategory),
  fieldName: 'whtRate',
})
```

**`defaults-suggester.ts`** — add `fromCrossTenant()`:
```typescript
// After frequency analysis returns empty:
const crossTenantMatch = await queryCrossTenantPattern({
  patternType: 'smart_default',
  triggerKey: normalizeTriggerKey('smart_default', docType, fieldName),
  fieldName, // 'department', 'costCenter', 'paymentTerms'
})
```

### Source Tracking

Cross-tenant suggestions use `source: 'cross_tenant'` in `ai_suggestions`. Invisible in UI (no distinction from other sources), but trackable in backoffice analytics and feeds back into the learning loop.

### Query Helper

```typescript
// src/lib/db/queries/cross-tenant-patterns.ts
async function queryCrossTenantPattern(params: {
  patternType: string
  triggerKey: string
  fieldName: string
}): Promise<CrossTenantPattern | null> {
  const thresholds = getMinThresholds(await getTotalTenantCount())

  return db.select()
    .from(crossTenantPatterns)
    .where(and(
      eq(crossTenantPatterns.patternType, params.patternType),
      eq(crossTenantPatterns.triggerKey, params.triggerKey),
      eq(crossTenantPatterns.fieldName, params.fieldName),
      gte(crossTenantPatterns.tenantCount, thresholds.minTenants),
      gte(crossTenantPatterns.agreementRatio, thresholds.minAgreement),
    ))
    .orderBy(desc(crossTenantPatterns.confidence))
    .limit(1)
    .then(rows => rows[0] ?? null)
}
```

---

## Onboarding Enrichment

### Where Cross-Tenant Patterns Appear

Enrich two existing onboarding steps with community suggestions:

**Step 2 (Workspace)** — add two new fields:
- **Industry** — dropdown: retail, manufacturing, services, construction, hospitality, healthcare, education, technology, other
- **Company Size** — radio group: micro (1-5), small (6-30), medium (31-200), large (200+)

Both saved to `tenants.industry` and `tenants.company_size`. Optional but shown prominently.

**Step 3 (COA Setup)** — after the tenant selects a COA template:
- Query cross-tenant patterns for common GL account mappings
- Show `SuggestionPill` components below relevant account categories
- User clicks to accept (adds the mapping) or skips

**Step 4 (Partners / Vendors)** — when adding vendors:
- If vendor tax ID is entered, query cross-tenant patterns for WHT rate + income type
- Show suggestion pill below WHT fields
- Also suggest default department/cost center if patterns exist

### UI Integration

Reuse existing `SuggestionPill` from 6C. Same accept/dismiss behavior. No new components needed.

### Onboarding Suggestion API

```
GET /api/onboarding/suggestions?step=coa&templateId=xxx
GET /api/onboarding/suggestions?step=partners&vendorTaxIds=xxx,yyy
```

Returns cross-tenant patterns formatted as suggestion arrays. Same shape as 6C suggestions but ephemeral (not persisted to `ai_suggestions`) — these are hints during setup.

### Modified Files

```
src/app/(app)/onboarding/steps/workspace-step.tsx     -- ADD: industry + company_size fields
src/app/(app)/onboarding/steps/coa-step.tsx            -- ADD: suggestion pills for GL mappings
src/app/(app)/onboarding/steps/partners-step.tsx       -- ADD: suggestion pills for WHT/defaults
src/app/api/onboarding/suggestions/route.ts            -- NEW: onboarding suggestion API
```

---

## AI Provider Abstraction

### Interface

```typescript
// src/lib/services/ai/provider.ts
interface AIProvider {
  chat(params: {
    model: string
    messages: ChatMessage[]
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
  }): Promise<AIResponse>

  chatWithVision(params: {
    model: string
    messages: ChatMessage[]
    images: ImageInput[]
    systemPrompt?: string
    maxTokens?: number
  }): Promise<AIResponse>
}

interface AIResponse {
  content: string
  usage: { inputTokens: number; outputTokens: number }
  model: string
  provider: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ImageInput {
  type: 'base64' | 'url'
  data: string
  mediaType: string
}
```

### Implementation

```
src/lib/services/ai/
  provider.ts              -- AIProvider interface + AIResponse types
  anthropic-provider.ts    -- AnthropicProvider implements AIProvider
  factory.ts               -- getProvider(name?: string): AIProvider
  models.ts                -- Model constants + pricing lookup for cost calculation
```

### Factory

```typescript
// factory.ts
const providers: Record<string, () => AIProvider> = {
  anthropic: () => new AnthropicProvider(),
}

function getProvider(name: string = 'anthropic'): AIProvider {
  const factory = providers[name]
  if (!factory) throw new Error(`Unknown AI provider: ${name}`)
  return factory()
}
```

### Migration Path

Refactor existing direct Anthropic SDK calls:

| File | Current | After |
|---|---|---|
| `tier1-haiku.ts` | `new Anthropic().messages.create(...)` | `getProvider().chat(...)` |
| `tier2-sonnet.ts` | `new Anthropic().messages.create(...)` | `getProvider().chat(...)` |
| `tier3-vision.ts` | `new Anthropic().messages.create(...)` | `getProvider().chatWithVision(...)` |
| `coa-suggester.ts` | `new Anthropic().messages.create(...)` | `getProvider().chat(...)` |

### Usage Logging Integration

`AnthropicProvider` returns standardized `AIResponse` with token counts. The caller writes to `ai_usage_logs` with the provider name from the response — no change to logging pattern.

### Out of Scope

- No provider selection UI in settings (hardcoded to Anthropic)
- No per-feature provider routing
- No embeddings method (deferred to chat phase)

---

## Backoffice Extension

### AI Overview Dashboard — New Section

Add a "Community Patterns" card section below the existing tier distribution chart:

| StatCard | Value | Subtitle |
|---|---|---|
| Active Patterns | Count where confidence meets threshold | "Meeting quality bar" |
| Pattern Coverage | % of suggestions sourced from cross-tenant | "vs tenant history / AI" |
| AI Calls Saved | Estimated calls avoided by cross-tenant hits | "Cost savings this month" |

### New Page: Pattern Explorer

Route: `/backoffice/patterns`

**Filter bar:**
- Pattern type dropdown: All, COA Mapping, WHT Rate, Smart Default
- Confidence slider: minimum confidence filter
- Search: trigger key text search

**DataTable columns:**

| Column | Content |
|---|---|
| Pattern Type | Badge: coa_mapping / wht_rate / smart_default |
| Trigger Key | Monospace text |
| Field | field_name |
| Suggested Value | The consensus value |
| Tenants | tenant_count |
| Samples | sample_count |
| Agreement | Ratio as percentage with color (green ≥80%, blue ≥65%, amber <65%) |
| Confidence | Mini progress bar + numeric |

No edit/delete actions for MVP — patterns are system-managed. Superadmin can view and analyze only.

### Backoffice Sidebar Update

Add "Patterns" nav item under **Analytics** group, below existing items.

### API Routes

```
GET /api/backoffice/patterns           -- Pattern list (paginated, filterable)
GET /api/backoffice/analytics/patterns -- Pattern stats for dashboard cards
```

Auth: superadmin-only (same as existing backoffice routes).

### File Structure

```
src/app/(backoffice)/backoffice/
  patterns/
    page.tsx                           -- Pattern Explorer page

src/app/api/backoffice/
  patterns/
    route.ts                           -- Pattern list API
  analytics/
    patterns/
      route.ts                         -- Pattern stats API

src/lib/hooks/
  use-backoffice.ts                    -- ADD: usePatterns, usePatternStats hooks
```

---

## Settings Changes

### Workspace Settings — Industry & Company Size

Add to the existing workspace/master data settings page:

**Industry** — dropdown: retail, manufacturing, services, construction, hospitality, healthcare, education, technology, other

**Company Size** — radio group: micro (1-5), small (6-30), medium (31-200), large (200+)

Saved via existing PATCH `/api/tenants/[id]` with new fields `industry` and `companySize`.

### No New Toggle Needed

Cross-tenant patterns are always active as another source for the existing suggestion system. The existing `tenants.suggestionsEnabled` toggle (from 6C) controls whether suggestions appear — when off, cross-tenant patterns are also off.

### Modified Files

```
src/app/(app)/settings/workspace/page.tsx    -- ADD: industry + company size fields
src/app/api/tenants/[id]/route.ts            -- ADD: industry, companySize to PATCH handler
```

---

## Complete File Structure

### New Files

```
src/lib/services/learning/
  cross-tenant-engine.ts                     -- Upsert patterns, confidence calc, thresholds
  trigger-keys.ts                            -- Normalize trigger keys per pattern type
  types.ts                                   -- CrossTenantPattern interface

src/lib/services/ai/
  provider.ts                                -- AIProvider interface + types
  anthropic-provider.ts                      -- AnthropicProvider implementation
  factory.ts                                 -- getProvider() factory
  models.ts                                  -- Model constants + pricing

src/lib/inngest/functions/
  update-cross-tenant-pattern.ts             -- Inngest handler for pattern updates

src/lib/db/queries/
  cross-tenant-patterns.ts                   -- Pattern query helpers

src/app/api/
  onboarding/
    suggestions/
      route.ts                               -- Onboarding suggestion API
  backoffice/
    patterns/
      route.ts                               -- Pattern list API
    analytics/
      patterns/
        route.ts                             -- Pattern stats API

src/app/(backoffice)/backoffice/
  patterns/
    page.tsx                                 -- Pattern Explorer page
```

### Modified Files

```
src/lib/db/schema.ts                         -- ADD: cross_tenant_patterns table, tenant columns
src/lib/services/suggestions/learner.ts      -- ADD: emit Inngest event on outcome
src/lib/services/suggestions/providers/
  coa-suggester.ts                           -- ADD: fromCrossTenant() step
  wht-suggester.ts                           -- ADD: fromCrossTenant() step
  defaults-suggester.ts                      -- ADD: fromCrossTenant() step
src/lib/services/extraction/tiers/
  tier1-haiku.ts                             -- REFACTOR: use getProvider()
  tier2-sonnet.ts                            -- REFACTOR: use getProvider()
  tier3-vision.ts                            -- REFACTOR: use getProvider()
src/app/(app)/onboarding/steps/
  workspace-step.tsx                         -- ADD: industry + company_size fields
  coa-step.tsx                               -- ADD: suggestion pills
  partners-step.tsx                          -- ADD: suggestion pills
src/app/(app)/settings/workspace/page.tsx    -- ADD: industry + company size fields
src/app/api/tenants/[id]/route.ts            -- ADD: industry, companySize to PATCH
src/components/backoffice-sidebar.tsx         -- ADD: Patterns nav item
src/lib/hooks/use-backoffice.ts              -- ADD: usePatterns, usePatternStats
src/app/(backoffice)/backoffice/
  overview/page.tsx                          -- ADD: community patterns stats section
```

---

## Success Criteria

### Database (must have)
- [ ] `cross_tenant_patterns` table with unique and lookup indexes
- [ ] `tenants.industry` and `tenants.company_size` columns
- [ ] Migration via `drizzle-kit generate` — staging only

### Pattern Engine (must have)
- [ ] Inngest event emitted on suggestion outcome processing
- [ ] Pattern upsert with tenant_count, sample_count, accept/dismiss tracking
- [ ] Confidence calculation with volume + agreement weighting
- [ ] Adaptive thresholds based on total tenant count
- [ ] Trigger key normalization (no PII in pattern data)

### Provider Integration (must have)
- [ ] Cross-tenant source in COA, WHT, and defaults suggesters
- [ ] Priority: tenant history → graduated rules → cross-tenant → AI fallback
- [ ] Suggestions use `source: 'cross_tenant'` (no UI distinction)
- [ ] Cross-tenant hits skip AI fallback (cost savings)

### Onboarding (must have)
- [ ] Industry + company size fields in Workspace step
- [ ] Suggestion pills in COA step (GL account mappings)
- [ ] Suggestion pills in Partners step (WHT rates, defaults)
- [ ] Onboarding suggestion API (ephemeral, not persisted)

### AI Provider Abstraction (must have)
- [ ] `AIProvider` interface with chat() and chatWithVision()
- [ ] `AnthropicProvider` implementation
- [ ] Factory function `getProvider()`
- [ ] All extraction tiers refactored to use provider
- [ ] COA suggester AI fallback refactored to use provider

### Backoffice (must have)
- [ ] Community patterns stats on AI Overview dashboard
- [ ] Pattern Explorer page with filter and DataTable
- [ ] Patterns API routes (superadmin-only)
- [ ] Patterns nav item in backoffice sidebar

### Settings (must have)
- [ ] Industry + company size editable in workspace settings
- [ ] PATCH handler updated for new fields

---

## Out of Scope — Deferred Items

### 1. AI Chat Interface → Future Phase

**What:** Cmd+K AI chat for open-ended accounting questions with document context.

**Why deferred:** The learning engine is higher priority. Chat requires conversation storage, streaming, multi-turn context — significant scope. Better as its own phase once the learning foundation is solid.

### 2. Industry-Based Segmentation → Future

**What:** Segment cross-tenant patterns by industry so retail tenants get retail-specific suggestions.

**Why deferred:** Insufficient tenant volume for MVP. Segmenting too early fragments the data pool. Industry/size data is collected now for future use.

**Schema readiness:** `tenants.industry` column exists. `cross_tenant_patterns` can add an optional `industry` column when segmentation is activated.

### 3. Pattern Override / Curation → Future

**What:** Superadmin ability to edit, delete, or manually create cross-tenant patterns.

**Why deferred:** Patterns should be system-managed for MVP. Manual curation adds complexity and risk of bias. Let the statistical engine prove itself first.

### 4. Pattern Decay / Expiry → Future

**What:** Patterns that haven't been reinforced in N months lose confidence or are pruned.

**Why deferred:** Not a concern at launch. Revisit when patterns have been accumulating for 6+ months.

### 5. Cross-Tenant Suggestion Analytics → Future

**What:** Backoffice dashboard showing cross-tenant suggestion acceptance rates, most/least effective patterns, accuracy trends.

**Why deferred:** Pattern Explorer provides basic visibility. Deeper analytics need sufficient data volume.

---

## Migration Plan

| Step | Action | Risk |
|------|--------|------|
| 1 | Add `cross_tenant_patterns` table + tenant columns | None — additive |
| 2 | Build AI provider abstraction | None — new directory |
| 3 | Refactor extraction tiers to use provider | Low — same behavior, different call path |
| 4 | Build pattern aggregation engine | None — new service |
| 5 | Wire Inngest event from learner to pattern engine | Low — extends existing flow |
| 6 | Add cross-tenant source to suggestion providers | Low — new fallback step |
| 7 | Add industry/size to onboarding + settings | None — additive fields |
| 8 | Add suggestion pills to onboarding steps | Low — reusing existing components |
| 9 | Build backoffice pattern explorer | None — new page |
| 10 | Add pattern stats to backoffice dashboard | Low — extends existing page |

All changes are additive. The suggestion system gains a new source without changing existing behavior. The extraction pipeline is refactored to use the provider abstraction but produces identical results.

**Migrations: staging only.** Do not apply to production without explicit approval.
