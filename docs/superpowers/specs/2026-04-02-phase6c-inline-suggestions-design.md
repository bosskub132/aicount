# Phase 6C: Inline AI Suggestions

**Date:** 2026-04-02
**Status:** Design approved
**Depends on:** Phase 6A (Extraction Accuracy — complete), Phase 6B (AI Foundation — complete)
**Feeds into:** Phase 6D (Chat + Cross-Tenant Learning Engine)

## Problem Statement

After Phase 6A (three-tier extraction) and 6B (usage logging, backoffice), the extraction pipeline produces accurate structured data. However:

1. **No GL account suggestions** — Users must manually select the correct chart of accounts entry for every journal line, even when the same vendor always maps to the same account.
2. **No WHT rate suggestions** — Users manually pick WHT income type and rate for every document, even when vendor history shows a consistent pattern.
3. **No duplicate detection** — Users can upload the same invoice twice with no warning, leading to double-booked entries.
4. **No smart defaults** — Fields like department, cost center, and payment terms are always blank, even when the tenant consistently uses the same values for a given vendor.

## Solution Overview

| Feature | What | Source | Trigger |
|---------|------|--------|---------|
| COA Mapping | Suggest GL account for journal lines | Vendor history → AI fallback | Eager (history) + Lazy (AI) |
| WHT Rate | Suggest WHT income type + rate | Vendor history → vendor type rules | Eager |
| Duplicate Detection | Flag potential duplicate documents | File hash (upload) + content match (lazy) | Upload + Lazy |
| Smart Defaults | Suggest department, cost center, payment terms | Vendor frequency analysis | Eager |

### UI Pattern

**Below-field suggestion pills** — compact pills appear 8px below the relevant field. User clicks the pill body to accept (fills the field, removes the pill) or clicks X to dismiss. When 2+ suggestions exist, a summary banner appears at top with "Accept All" / "Clear All". Duplicate warnings use a separate amber banner.

All suggestion interactions are tracked in **local state** and batch-submitted with the form save — no per-interaction API calls.

---

## Database Schema

### New Table: `ai_suggestions`

Tracks every suggestion generated, its lifecycle, and feeds the learning loop.

```sql
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID REFERENCES documents(id),
  feature TEXT NOT NULL,                             -- 'coa_mapping', 'wht_rate', 'duplicate', 'smart_default'
  field_name TEXT NOT NULL,                          -- 'glAccountCode', 'whtRate', 'department', etc.
  suggested_value TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL,                  -- 0.00-1.00
  source TEXT NOT NULL,                              -- 'vendor_history', 'graduated_rule', 'ai_model', 'frequency'
  source_context JSONB,                              -- debug: vendor match details, rule ID, etc.
  status TEXT NOT NULL DEFAULT 'pending',             -- 'pending', 'accepted', 'dismissed', 'edited'
  final_value TEXT,                                   -- what user actually used (for 'edited' status)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_suggestions_document ON ai_suggestions(document_id) WHERE status = 'pending';
CREATE INDEX idx_suggestions_tenant_feature ON ai_suggestions(tenant_id, feature, created_at);
```

### New Table: `ai_duplicate_candidates`

Stores duplicate match pairs found during the two-pass check.

```sql
CREATE TABLE ai_duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID NOT NULL REFERENCES documents(id),
  match_document_id UUID NOT NULL REFERENCES documents(id),
  match_type TEXT NOT NULL,                           -- 'file_hash', 'content_match'
  match_score NUMERIC(3,2) NOT NULL,                  -- 0.00-1.00
  match_details JSONB,                                -- which fields matched, similarity scores
  status TEXT NOT NULL DEFAULT 'pending',              -- 'pending', 'dismissed', 'confirmed_duplicate'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duplicates_document ON ai_duplicate_candidates(document_id) WHERE status = 'pending';
```

### Schema Changes to Existing Tables

```sql
-- Tenant suggestion toggle
ALTER TABLE tenants ADD COLUMN suggestions_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- File hash for quick duplicate detection at upload
ALTER TABLE documents ADD COLUMN file_hash TEXT;
CREATE INDEX idx_documents_file_hash ON documents(file_hash) WHERE file_hash IS NOT NULL;
```

**Design decisions:**
- `ai_suggestions` is separate from `ai_usage_logs` — usage logs track costs, suggestions track UX lifecycle
- `source` column distinguishes cheap lookups (`vendor_history`, `graduated_rule`, `frequency`) from expensive ones (`ai_model`) — supports hybrid trigger model
- `final_value` on edited suggestions captures the "close but wrong" signal for learning
- `file_hash` on documents enables instant duplicate check at upload before extraction runs
- `suggestions_enabled` is a simple boolean toggle for 6C; granular per-feature toggles deferred

---

## Suggestion Service Architecture

### File Structure

```
src/lib/services/suggestions/
  coordinator.ts                    -- Orchestrates providers, merges results
  types.ts                          -- Suggestion/duplicate interfaces
  providers/
    coa-suggester.ts                -- GL account suggestions (history + AI)
    wht-suggester.ts                -- WHT rate suggestions (history + rules)
    duplicate-checker.ts            -- Two-pass duplicate detection
    defaults-suggester.ts           -- Smart defaults (dept, cost center, terms)
  tracking.ts                       -- Process batch outcomes from form submit
  learner.ts                        -- Feed outcomes into rule confidence
```

### Coordinator Pattern

```typescript
// coordinator.ts
async function getSuggestions(documentId: string, tenantId: string, mode: 'eager' | 'lazy') {
  // eager = called during extraction pipeline (cheap providers only)
  // lazy  = called when user opens extraction page (all providers)

  const providers = mode === 'eager'
    ? [coaSuggester.fromHistory, whtSuggester.fromHistory, defaultsSuggester]
    : [coaSuggester.full, whtSuggester.full, duplicateChecker.contentMatch]

  const results = await Promise.allSettled(providers.map(p => p(documentId, tenantId)))
  // merge, deduplicate, sort by confidence, save to ai_suggestions table
  return mergedSuggestions
}
```

### Provider Contract

Each provider returns the same shape:

```typescript
interface SuggestionResult {
  feature: 'coa_mapping' | 'wht_rate' | 'duplicate' | 'smart_default'
  fieldName: string
  suggestedValue: string
  confidence: number
  source: 'vendor_history' | 'graduated_rule' | 'ai_model' | 'frequency'
  sourceContext?: Record<string, unknown>
}
```

### Provider Details

**COA Suggester (`coa-suggester.ts`)**
- `fromHistory` (eager): Query `journal_lines` for same vendor (by issuer tax ID) → most frequent GL account code. Confidence = frequency ratio (e.g., 8/10 past docs used account 5310 → 0.80).
- `full` (lazy): If no history match, call Claude Haiku with line item descriptions + tenant's chart of accounts → suggest best match. Writes to `ai_usage_logs` with `feature='suggestion'`.

**WHT Suggester (`wht-suggester.ts`)**
- `fromHistory` (eager): Query past documents for same vendor → most frequent WHT rate + income type. Frequency-based confidence.
- `full` (lazy): If no history, check vendor master data (`vendors.vendorType`) → individual=ภ.ง.ด.3, company=ภ.ง.ด.53. Suggest standard rate by income type. Rule-based, no AI call.

**Duplicate Checker (`duplicate-checker.ts`)**
- Pass 1 — `fileHash` (at upload, before extraction): SHA-256 of uploaded file → exact match in `documents.file_hash` for same tenant. Confidence: 1.00.
- Pass 2 — `contentMatch` (lazy, after extraction): Query documents with same issuer tax ID + amount within 5% + date within 30 days. Score based on field alignment.

**Defaults Suggester (`defaults-suggester.ts`)**
- Eager only, no AI call. Query tenant's recent documents for same vendor → suggest department, cost center, payment terms. Frequency-based confidence.

### Data Source

Tenant history only for Phase 6C. Schema supports cross-tenant suggestions for Phase 6D (anonymized patterns), but no cross-tenant lookups are implemented in this phase.

---

## Triggering Model

### Hybrid: Eager + Lazy

**At Upload (instant):**
```
User uploads file
  → Upload API computes SHA-256 file_hash
  → Stores file_hash on documents row
  → Queries documents with matching file_hash + same tenant
  → If match: writes to ai_duplicate_candidates (match_type: 'file_hash', score: 1.00)
```

**During Extraction (Inngest pipeline, eager):**
```
Extraction completes (step 2)
  → New step 2.5: coordinator.getSuggestions(docId, tenantId, 'eager')
  → Runs cheap providers only:
      - coa-suggester.fromHistory
      - wht-suggester.fromHistory
      - defaults-suggester
  → Writes results to ai_suggestions table
  → Non-blocking: failure does not affect extraction pipeline
```

**On Page Open (lazy):**
```
User opens /extractions?docId=xxx
  → Frontend calls GET /api/documents/[id]/suggestions
  → Backend checks: are lazy providers already run?
      - If not: runs lazy providers in parallel:
          - coa-suggester.full (AI call if no history match)
          - duplicate-checker.contentMatch (issuer + amount + date)
      - Writes new suggestions to ai_suggestions
      - Marks lazy run complete (sets `ai_suggestions` rows exist for this doc — subsequent GET skips lazy providers)
  → Returns all pending suggestions + duplicate candidates
  → Frontend renders pills + banners
```

---

## UI Components

### Suggestion Pill (`suggestion-pill.tsx`)

Below-field pill that suggests a value for an empty field.

**Visual spec:**
- Background: `bg-[#EFF6FF]`
- Border: `border border-[#BFDBFE]`
- Border radius: `rounded-xl` (12px)
- Padding: `px-3.5 py-1.5` (14px horizontal, 6px vertical)
- Gap from field: `mt-2` (8px)
- Text: 12px, `font-medium`, `text-[#2563EB]`
- Confidence: 10px, `text-[#93C5FD]`
- X button: 18px font-size, 18x18 flex-centered, `text-[#6B9BD2]`, 4px left margin

**Behavior:**
- Click pill body → `onAccept` callback → field fills with value → pill disappears
- Click X → `onDismiss` callback → pill disappears, field stays empty

### Suggestion Banner (`suggestion-banner.tsx`)

Summary banner shown when 2+ pending suggestions exist.

**Visual spec:**
- Background: `bg-[#EFF6FF]`
- Border: `border border-[#BFDBFE]`, `border-l-3 border-l-[#2563EB]`
- Content: "✨ N suggestions available · Review below"
- Actions: "Accept All" (primary blue button), "Clear All" (ghost button)
- Hidden when 0-1 suggestions

### Duplicate Warning Banner (`duplicate-warning-banner.tsx`)

Amber banner for duplicate detection warnings.

**Visual spec:**
- Background: `bg-amber-50`
- Border: `border border-amber-200`, `border-l-3 border-l-amber-400`
- Content: "⚠ Possible duplicate" + matched document info (number, issuer, date, amount)
- Actions: "Compare" (outlined blue button), "Dismiss" (ghost button)
- For exact file hash matches: "This file has already been uploaded" with link to existing document

### Duplicate Compare Modal (`duplicate-compare-modal.tsx`)

Side-by-side comparison of current document vs matched document.

- Modal size: `xl` (max-w-4xl)
- Two columns: "Current Document" vs "Existing Document"
- Show key fields: issuer, invoice number, date, amounts, status
- Actions: "Keep Both" (dismiss duplicate), "View Original" (navigate to matched doc)

### Settings Toggle

In existing `/settings/accounting/ai-usage` page:
- Toggle component below budget section
- Label: "AI Suggestions"
- Subtitle: "Show automatic suggestions for GL accounts, WHT rates, and more"
- Toggles `tenants.suggestions_enabled`
- When off: coordinator is not called, no pills rendered

---

## User Interaction & State Management

All suggestion interactions are managed in **local state** and batch-submitted on form save.

```
User opens page → suggestions loaded into local state

Click pill body → local state: mark as 'accepted', fill field value
Click X on pill → local state: mark as 'dismissed', remove pill
Accept All → local state: mark all as 'accepted', fill all fields
User edits accepted field → local state: mark as 'edited', store final_value
Compare/Dismiss duplicate → local state only

User clicks "Save Draft" or "Submit for Approval"
  → Single request includes document fields + suggestion outcomes:
     {
       ...documentFields,
       suggestionOutcomes: [
         { id: "abc", status: "accepted" },
         { id: "def", status: "dismissed" },
         { id: "ghi", status: "edited", finalValue: "5320" }
       ],
       duplicateOutcomes: [
         { id: "xyz", status: "dismissed" }
       ]
     }
  → Backend processes field saves + suggestion tracking in one transaction
  → Learner runs after commit (non-blocking)
```

**Benefits:** One network call, no orphaned records, simpler error handling.

---

## API Routes

### New Routes

```
GET    /api/documents/[id]/suggestions              -- Fetch suggestions (triggers lazy if needed)
PATCH  /api/documents/[id]/suggestions/[sid]         -- Update single suggestion status
POST   /api/documents/[id]/suggestions/accept-all    -- Batch accept all pending
GET    /api/documents/[id]/duplicates                -- Fetch duplicate candidates
PATCH  /api/documents/[id]/duplicates/[did]          -- Dismiss or confirm duplicate
PATCH  /api/settings/suggestions                     -- Toggle on/off
```

### Auth Pattern

All suggestion routes use standard tenant-scoped auth:
```typescript
const ctx = getRequestContext(request);
if (!ctx) return unauthorized();
if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");
```

### Usage Logging

AI-powered suggestions (lazy COA via Claude) write to `ai_usage_logs` with `feature: 'suggestion'`. This automatically appears in backoffice AI Overview dashboard — no Phase 6B changes needed.

---

## Tracking & Learning

### Suggestion Lifecycle Tracking

Track accepts, dismissals, and edits to improve future suggestions.

**On form submit**, `tracking.ts` processes the batch outcomes:
- Updates `ai_suggestions` rows: status, final_value, resolved_at
- Passes outcomes to `learner.ts`

### Learning Loop (`learner.ts`)

- **Accepted:** Boosts confidence for similar future suggestions (same vendor + same field → higher frequency score)
- **Dismissed:** Decreases confidence. After 3+ dismissals of same pattern → stop suggesting it
- **Edited:** Records correction. If user consistently edits suggested value for vendor X → future suggestions use the corrected value

This integrates with Phase 6A's rule learner — suggestion corrections create/update `ai_extraction_rules` using the same confidence adjustment mechanics.

---

## File Structure (Complete)

### New Files

```
src/lib/services/suggestions/
  coordinator.ts
  types.ts
  providers/
    coa-suggester.ts
    wht-suggester.ts
    duplicate-checker.ts
    defaults-suggester.ts
  tracking.ts
  learner.ts

src/lib/db/queries/
  suggestions.ts
  duplicates.ts

src/lib/hooks/
  use-suggestions.ts
  use-suggestion-state.ts

src/components/
  suggestion-pill.tsx
  suggestion-banner.tsx
  duplicate-warning-banner.tsx
  duplicate-compare-modal.tsx

src/app/api/
  documents/[id]/
    suggestions/
      route.ts
      [suggestionId]/
        route.ts
    duplicates/
      route.ts
      [duplicateId]/
        route.ts
  settings/
    suggestions/
      route.ts
```

### Modified Files

```
src/lib/db/schema.ts                                    -- ADD: ai_suggestions, ai_duplicate_candidates, tenant/document columns
src/lib/services/extraction/pipeline.ts                  -- ADD: eager suggestion step after extraction
src/app/(app)/extractions/page.tsx                       -- ADD: pills, banners, local suggestion state, batch submit
src/app/api/documents/[id]/route.ts                      -- ADD: process suggestionOutcomes in save/submit handler
src/app/(app)/settings/accounting/ai-usage/page.tsx      -- ADD: suggestions toggle
src/lib/inngest/functions/process-document.ts            -- ADD: file hash computation + eager suggestions step
```

---

## Success Criteria

### Database (must have)
- [ ] `ai_suggestions` table with indexes
- [ ] `ai_duplicate_candidates` table with indexes
- [ ] `documents.file_hash` column with index
- [ ] `tenants.suggestions_enabled` column
- [ ] Migration via `drizzle-kit generate`

### Suggestion Providers (must have)
- [ ] COA suggester: history lookup (eager) + AI fallback (lazy)
- [ ] WHT suggester: history lookup (eager) + vendor type rules (lazy)
- [ ] Duplicate checker: file hash at upload + content match (lazy)
- [ ] Defaults suggester: frequency-based dept/cost center/terms (eager)

### Pipeline Integration (must have)
- [ ] File hash computed at upload
- [ ] Eager suggestions run after extraction (non-blocking)
- [ ] Lazy suggestions triggered on page open
- [ ] AI suggestions write to `ai_usage_logs` with `feature='suggestion'`

### UI (must have)
- [ ] SuggestionPill component (14px padding, 8px gap, centered 18px X)
- [ ] SuggestionBanner (Accept All / Clear All, shown when 2+ suggestions)
- [ ] DuplicateWarningBanner (amber, Compare / Dismiss)
- [ ] DuplicateCompareModal (side-by-side fields)
- [ ] Local state for suggestion interactions, batch submit on save
- [ ] Suggestions toggle in AI Usage settings

### Tracking & Learning (must have)
- [ ] Batch suggestion outcomes processed on form submit
- [ ] Accepted/dismissed/edited status recorded
- [ ] Learner feeds outcomes into rule confidence
- [ ] 3+ dismissals of same pattern → stop suggesting

---

## Out of Scope — Deferred Items

### 1. Cross-Tenant Suggestions → Phase 6D

**What:** Anonymized suggestion patterns aggregated across tenants. New tenants benefit from platform-wide vendor→account mappings.

**Why deferred:** Requires privacy framework, anonymization pipeline, and opt-in consent. Phase 6C establishes the per-tenant foundation.

**Schema readiness:** `ai_suggestions.source` can be `'cross_tenant'`. `ai_extraction_rules.tenant_id` nullable supports global rules.

### 2. Granular Per-Feature Toggles → Future

**What:** Individual on/off toggles for COA suggestions, WHT suggestions, duplicate detection, smart defaults.

**Why deferred:** Simple on/off is sufficient for MVP. Granular control adds settings complexity with unclear user demand.

**What's needed:** Add `suggestion_features_enabled JSONB` column to tenants, UI with 4 toggles in settings.

### 3. Auto-Accept High-Confidence Suggestions → Future

**What:** Suggestions above 95% confidence automatically fill the field without showing a pill.

**Why deferred:** Users need to build trust in the suggestion system first. Auto-filling without user action is risky for accounting accuracy.

### 4. Suggestion Analytics in Backoffice → Future

**What:** Dashboard showing suggestion acceptance rates, most/least accepted suggestion types, per-tenant suggestion accuracy.

**Why deferred:** Needs sufficient data volume to be meaningful. Better suited for a Phase 6B backoffice enhancement after 6C has been live.

### 5. AI Provider Abstraction → Pre-6D

**What:** Abstract `AIProvider` interface for swappable AI providers.

**Why deferred:** Same as Phase 6B deferral. Only one provider (Anthropic) in use. Deferred to pre-6D when chat features will benefit from abstraction.

---

## Future Expansion Points

| Hook | Design | Used By |
|------|--------|---------|
| `ai_suggestions.source = 'cross_tenant'` | New source value for cross-tenant suggestions | Phase 6D |
| `ai_usage_logs.feature = 'suggestion'` | Already defined in Phase 6B schema | Phase 6C (this phase) |
| `tenants.suggestions_enabled` | Simple boolean now; can become JSONB for granular toggles | Future settings |
| Coordinator provider array | Add new providers without changing coordinator | Future suggestion types |
| Learner integration with rule system | Suggestion outcomes feed same rules as extraction corrections | Phase 6D learning engine |

---

## Migration Plan

| Step | Action | Risk |
|------|--------|------|
| 1 | Add new DB tables + columns | None — additive |
| 2 | Build suggestion service layer | None — new directory |
| 3 | Add file hash at upload | Low — additive to upload handler |
| 4 | Add eager step to Inngest pipeline | Low — non-blocking, failure safe |
| 5 | Build UI components (pill, banners, modal) | None — new components |
| 6 | Integrate into extraction page | Medium — modifying large existing page |
| 7 | Add lazy trigger API | None — new route |
| 8 | Add tracking + learning | Low — extends existing rule learner |
| 9 | Add settings toggle | None — additive to existing page |

All changes are additive. The extraction pipeline gains a non-blocking suggestion step. The extraction page gains pills and banners without changing existing field editing behavior.
