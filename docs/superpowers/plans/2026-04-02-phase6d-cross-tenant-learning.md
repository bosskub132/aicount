# Phase 6D: Cross-Tenant Learning Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anonymized cross-tenant pattern aggregation so new tenants get smart suggestions from day one, build AI provider abstraction, and enrich onboarding with community-sourced defaults.

**Architecture:** Event-driven pattern table updated via Inngest when suggestion outcomes are processed. Cross-tenant patterns slot into existing suggestion providers as a new source between graduated rules and AI fallback. AI provider abstraction wraps Anthropic SDK behind an interface for all extraction and suggestion calls.

**Tech Stack:** Next.js 16, Drizzle ORM, Inngest, Anthropic SDK, React, Tailwind CSS v4, Zustand, React Query

---

## File Structure

### New Files

```
src/lib/services/ai/
  provider.ts                                -- AIProvider interface + types
  anthropic-provider.ts                      -- AnthropicProvider implementation
  factory.ts                                 -- getProvider() factory
  models.ts                                  -- Model constants + pricing

src/lib/services/learning/
  cross-tenant-engine.ts                     -- Upsert patterns, confidence calc
  trigger-keys.ts                            -- Normalize trigger keys per type
  types.ts                                   -- CrossTenantPattern interface

src/lib/inngest/functions/
  update-cross-tenant-pattern.ts             -- Inngest handler

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
src/lib/db/schema.ts                         -- ADD: crossTenantPatterns table, tenant columns
src/lib/services/suggestions/types.ts        -- ADD: 'cross_tenant' source type
src/lib/services/suggestions/learner.ts      -- ADD: emit Inngest event
src/lib/services/suggestions/coordinator.ts  -- ADD: cross-tenant in provider chain
src/lib/services/suggestions/providers/
  coa-suggester.ts                           -- ADD: fromCrossTenant(), refactor to provider
  wht-suggester.ts                           -- ADD: fromCrossTenant()
  defaults-suggester.ts                      -- ADD: fromCrossTenant()
src/lib/services/extraction/tiers/
  tier1-haiku.ts                             -- REFACTOR: use getProvider()
  tier2-sonnet.ts                            -- REFACTOR: use getProvider()
  tier3-vision.ts                            -- REFACTOR: use getProvider()
src/app/(onboarding)/onboarding/workspace/page.tsx  -- ADD: industry + company_size
src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx  -- ADD: suggestion pills
src/app/(onboarding)/onboarding/partners/page.tsx   -- ADD: suggestion pills
src/app/(app)/settings/workspace/page.tsx    -- ADD: industry + company size
src/app/api/tenants/[id]/route.ts            -- ADD: industry, companySize to PUT
src/components/backoffice-sidebar.tsx         -- ADD: Patterns nav item
src/lib/hooks/use-backoffice.ts              -- ADD: usePatterns, usePatternStats
src/app/(backoffice)/backoffice/overview/page.tsx -- ADD: pattern stats section
src/lib/inngest/client.ts                    -- ADD: register new function
```

---

## Task 1: Database Schema — Cross-Tenant Patterns Table + Tenant Columns

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add `crossTenantPatterns` table to schema.ts**

Open `src/lib/db/schema.ts`. Add after the `aiSuggestions` table definition (around line 921):

```typescript
export const crossTenantPatterns = pgTable("cross_tenant_patterns", {
  id: uuid("id").defaultRandom().primaryKey(),
  patternType: text("pattern_type").notNull(),
  triggerKey: text("trigger_key").notNull(),
  fieldName: text("field_name").notNull(),
  suggestedValue: text("suggested_value").notNull(),
  tenantCount: integer("tenant_count").notNull().default(1),
  sampleCount: integer("sample_count").notNull().default(1),
  acceptCount: integer("accept_count").notNull().default(0),
  dismissCount: integer("dismiss_count").notNull().default(0),
  agreementRatio: decimal("agreement_ratio", { precision: 3, scale: 2 }).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_patterns_unique").on(
    table.patternType, table.triggerKey, table.fieldName, table.suggestedValue
  ),
  index("idx_patterns_lookup").on(table.patternType, table.triggerKey),
]);
```

- [ ] **Step 2: Add `industry` and `companySize` columns to tenants table**

In the `tenants` pgTable definition (around line 91-112), add two new columns:

```typescript
  industry: text("industry"),
  companySize: text("company_size"),
```

- [ ] **Step 3: Generate migration**

Run:
```bash
npx drizzle-kit generate
```

Expected: A new migration file in `supabase/migrations/` with `CREATE TABLE cross_tenant_patterns` and `ALTER TABLE tenants ADD COLUMN industry/company_size`.

- [ ] **Step 4: Apply migration to staging only**

Use the Supabase MCP `apply_migration` tool to apply the generated migration to the staging project. Do NOT apply to production.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts supabase/migrations/
git commit -m "feat: add cross_tenant_patterns table and tenant industry/size columns"
```

---

## Task 2: AI Provider Abstraction — Interface + Anthropic Implementation

**Files:**
- Create: `src/lib/services/ai/provider.ts`
- Create: `src/lib/services/ai/anthropic-provider.ts`
- Create: `src/lib/services/ai/factory.ts`
- Create: `src/lib/services/ai/models.ts`

- [ ] **Step 1: Create provider interface**

Create `src/lib/services/ai/provider.ts`:

```typescript
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ImageInput {
  type: "base64" | "url";
  data: string;
  mediaType: string;
}

export interface AIResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: string;
}

export interface AIProvider {
  chat(params: {
    model: string;
    messages: ChatMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse>;

  chatWithVision(params: {
    model: string;
    messages: ChatMessage[];
    images: ImageInput[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<AIResponse>;
}
```

- [ ] **Step 2: Create model constants and pricing**

Create `src/lib/services/ai/models.ts`:

```typescript
export const MODELS = {
  HAIKU: "claude-haiku-4-5-20251001",
  SONNET: "claude-sonnet-4-6-20260320",
} as const;

// Pricing per 1M tokens in USD
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-6-20260320": { input: 3.00, output: 15.00 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
```

- [ ] **Step 3: Create AnthropicProvider implementation**

Create `src/lib/services/ai/anthropic-provider.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIResponse, ChatMessage, ImageInput } from "./provider";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async chat(params: {
    model: string;
    messages: ChatMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.systemPrompt && { system: params.systemPrompt }),
      messages: params.messages.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      content: textBlock?.text ?? "",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: params.model,
      provider: "anthropic",
    };
  }

  async chatWithVision(params: {
    model: string;
    messages: ChatMessage[];
    images: ImageInput[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const imageBlocks = params.images.map((img) => ({
      type: "image" as const,
      source:
        img.type === "base64"
          ? {
              type: "base64" as const,
              media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: img.data,
            }
          : {
              type: "url" as const,
              url: img.data,
            },
    }));

    const lastMessage = params.messages[params.messages.length - 1];
    const messagesWithImages = [
      ...params.messages.slice(0, -1).map((m) => ({
        role: m.role === "system" ? ("user" as const) : (m.role as "user" | "assistant"),
        content: m.content,
      })),
      {
        role: "user" as const,
        content: [
          ...imageBlocks,
          { type: "text" as const, text: lastMessage.content },
        ],
      },
    ];

    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 1500,
      ...(params.systemPrompt && { system: params.systemPrompt }),
      messages: messagesWithImages,
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      content: textBlock?.text ?? "",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: params.model,
      provider: "anthropic",
    };
  }
}
```

- [ ] **Step 4: Create factory**

Create `src/lib/services/ai/factory.ts`:

```typescript
import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./anthropic-provider";

const providers: Record<string, () => AIProvider> = {
  anthropic: () => new AnthropicProvider(),
};

let cachedProvider: AIProvider | null = null;
let cachedProviderName: string | null = null;

export function getProvider(name: string = "anthropic"): AIProvider {
  if (cachedProvider && cachedProviderName === name) {
    return cachedProvider;
  }
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown AI provider: ${name}`);
  }
  cachedProvider = factory();
  cachedProviderName = name;
  return cachedProvider;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ai/
git commit -m "feat: add AI provider abstraction with AnthropicProvider"
```

---

## Task 3: Refactor Extraction Tiers to Use Provider Abstraction

**Files:**
- Modify: `src/lib/services/extraction/tiers/tier1-haiku.ts`
- Modify: `src/lib/services/extraction/tiers/tier2-sonnet.ts`
- Modify: `src/lib/services/extraction/tiers/tier3-vision.ts`
- Modify: `src/lib/services/suggestions/providers/coa-suggester.ts`

- [ ] **Step 1: Refactor tier1-haiku.ts**

Replace the Anthropic import and client creation:

```typescript
// REMOVE:
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic();

// ADD:
import { getProvider } from "@/lib/services/ai/factory";
```

Replace the `anthropic.messages.create()` call with:

```typescript
const provider = getProvider();
const response = await provider.chat({
  model: "claude-haiku-4-5-20251001",
  maxTokens: 1500,
  messages: [{ role: "user", content: prompt }],
});
```

Update the token/cost extraction to use the provider response shape:

```typescript
// BEFORE (Anthropic SDK response):
const inputTokens = response.usage.input_tokens;
const outputTokens = response.usage.output_tokens;
const content = response.content[0].type === "text" ? response.content[0].text : "";

// AFTER (AIResponse):
const inputTokens = response.usage.inputTokens;
const outputTokens = response.usage.outputTokens;
const content = response.content;
```

- [ ] **Step 2: Refactor tier2-sonnet.ts**

Same pattern as Step 1. Replace Anthropic import with `getProvider()`. Update the model to use the sonnet model constant. Update token/content access.

- [ ] **Step 3: Refactor tier3-vision.ts**

Replace Anthropic import with `getProvider()`. Change `anthropic.messages.create()` with vision content to:

```typescript
const provider = getProvider();
const response = await provider.chatWithVision({
  model: "claude-sonnet-4-6-20260320",
  maxTokens: 1500,
  messages: [{ role: "user", content: prompt }],
  images: [{
    type: "base64",
    data: imageBase64,
    mediaType: imageMimeType,
  }],
});
```

Update token/content access to use `response.usage.inputTokens`, `response.usage.outputTokens`, `response.content`.

- [ ] **Step 4: Refactor coa-suggester.ts AI fallback**

In the `full()` function, replace the Anthropic import and direct SDK call:

```typescript
// REMOVE:
import Anthropic from "@anthropic-ai/sdk";

// ADD:
import { getProvider } from "@/lib/services/ai/factory";

// In full() function, replace:
// const client = new Anthropic();
// const response = await client.messages.create({...});
// WITH:
const provider = getProvider();
const response = await provider.chat({
  model: "claude-haiku-4-5-20251001",
  maxTokens: 256,
  messages: [{ role: "user", content: prompt }],
});
```

Update content/token access accordingly.

- [ ] **Step 5: Verify build passes**

Run:
```bash
npx next build
```

Expected: Build succeeds with no type errors. All existing behavior unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/extraction/tiers/ src/lib/services/suggestions/providers/coa-suggester.ts
git commit -m "refactor: migrate extraction tiers and COA suggester to AI provider abstraction"
```

---

## Task 4: Cross-Tenant Learning Engine — Types + Trigger Keys

**Files:**
- Create: `src/lib/services/learning/types.ts`
- Create: `src/lib/services/learning/trigger-keys.ts`

- [ ] **Step 1: Create learning types**

Create `src/lib/services/learning/types.ts`:

```typescript
export type PatternType = "coa_mapping" | "wht_rate" | "smart_default";

export interface CrossTenantPattern {
  id: string;
  patternType: PatternType;
  triggerKey: string;
  fieldName: string;
  suggestedValue: string;
  tenantCount: number;
  sampleCount: number;
  acceptCount: number;
  dismissCount: number;
  agreementRatio: number;
  confidence: number;
  metadata: PatternMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatternMetadata {
  tenantHashes: string[];
  [key: string]: unknown;
}

export interface PatternOutcome {
  patternType: PatternType;
  triggerKey: string;
  fieldName: string;
  suggestedValue: string;
  status: "accepted" | "dismissed" | "edited";
  tenantId: string;
}

export interface AdaptiveThresholds {
  minTenants: number;
  minAgreement: number;
}
```

- [ ] **Step 2: Create trigger key normalization**

Create `src/lib/services/learning/trigger-keys.ts`:

```typescript
import type { PatternType } from "./types";

export function normalizeTriggerKey(
  patternType: PatternType,
  ...parts: (string | null | undefined)[]
): string {
  const filtered = parts.filter(Boolean) as string[];

  switch (patternType) {
    case "coa_mapping": {
      // parts: [vendorTaxId, docType]
      const taxIdPrefix = filtered[0]?.slice(0, 4) ?? "unknown";
      const docType = filtered[1] ?? "unknown";
      return `${taxIdPrefix}:${docType}`;
    }
    case "wht_rate": {
      // parts: [vendorType, incomeCategory]
      const vendorType = filtered[0] ?? "unknown";
      const incomeCategory = filtered[1] ?? "unknown";
      return `${vendorType}:${incomeCategory}`;
    }
    case "smart_default": {
      // parts: [docType, fieldName]
      const docType = filtered[0] ?? "unknown";
      const fieldName = filtered[1] ?? "unknown";
      return `${docType}:${fieldName}`;
    }
    default:
      return filtered.join(":");
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/learning/
git commit -m "feat: add cross-tenant learning types and trigger key normalization"
```

---

## Task 5: Cross-Tenant Learning Engine — Core Engine + Queries

**Files:**
- Create: `src/lib/services/learning/cross-tenant-engine.ts`
- Create: `src/lib/db/queries/cross-tenant-patterns.ts`

- [ ] **Step 1: Create pattern query helpers**

Create `src/lib/db/queries/cross-tenant-patterns.ts`:

```typescript
import { db } from "@/lib/db";
import { crossTenantPatterns, tenants } from "@/lib/db/schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";
import type { AdaptiveThresholds, CrossTenantPattern } from "@/lib/services/learning/types";

export async function getTotalTenantCount(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(tenants)
    .where(sql`${tenants.deletedAt} IS NULL`);
  return result[0]?.count ?? 0;
}

export function getMinThresholds(totalTenants: number): AdaptiveThresholds {
  if (totalTenants < 10) return { minTenants: 3, minAgreement: 0.60 };
  if (totalTenants < 50) return { minTenants: 5, minAgreement: 0.65 };
  if (totalTenants < 200) return { minTenants: 8, minAgreement: 0.70 };
  return { minTenants: 10, minAgreement: 0.75 };
}

export async function queryCrossTenantPattern(params: {
  patternType: string;
  triggerKey: string;
  fieldName: string;
}): Promise<CrossTenantPattern | null> {
  const totalTenants = await getTotalTenantCount();
  const thresholds = getMinThresholds(totalTenants);

  const rows = await db
    .select()
    .from(crossTenantPatterns)
    .where(
      and(
        eq(crossTenantPatterns.patternType, params.patternType),
        eq(crossTenantPatterns.triggerKey, params.triggerKey),
        eq(crossTenantPatterns.fieldName, params.fieldName),
        gte(crossTenantPatterns.tenantCount, thresholds.minTenants),
        gte(crossTenantPatterns.agreementRatio, String(thresholds.minAgreement))
      )
    )
    .orderBy(desc(crossTenantPatterns.confidence))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    patternType: row.patternType as CrossTenantPattern["patternType"],
    triggerKey: row.triggerKey,
    fieldName: row.fieldName,
    suggestedValue: row.suggestedValue,
    tenantCount: row.tenantCount,
    sampleCount: row.sampleCount,
    acceptCount: row.acceptCount,
    dismissCount: row.dismissCount,
    agreementRatio: Number(row.agreementRatio),
    confidence: Number(row.confidence),
    metadata: row.metadata as CrossTenantPattern["metadata"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function upsertPattern(params: {
  patternType: string;
  triggerKey: string;
  fieldName: string;
  suggestedValue: string;
  isAccepted: boolean;
  tenantHash: string;
}): Promise<void> {
  const { patternType, triggerKey, fieldName, suggestedValue, isAccepted, tenantHash } = params;

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(crossTenantPatterns)
      .where(
        and(
          eq(crossTenantPatterns.patternType, patternType),
          eq(crossTenantPatterns.triggerKey, triggerKey),
          eq(crossTenantPatterns.fieldName, fieldName),
          eq(crossTenantPatterns.suggestedValue, suggestedValue)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const meta = (row.metadata ?? { tenantHashes: [] }) as { tenantHashes: string[] };
      const tenantHashes = meta.tenantHashes ?? [];
      const isNewTenant = !tenantHashes.includes(tenantHash);

      const newSampleCount = row.sampleCount + 1;
      const newAcceptCount = row.acceptCount + (isAccepted ? 1 : 0);
      const newDismissCount = row.dismissCount + (isAccepted ? 0 : 1);
      const newTenantHashes = isNewTenant ? [...tenantHashes, tenantHash] : tenantHashes;
      const newTenantCount = newTenantHashes.length;
      const newAgreementRatio = newAcceptCount / newSampleCount;
      const newConfidence = calculateConfidence(newTenantCount, newSampleCount, newAgreementRatio);

      await tx
        .update(crossTenantPatterns)
        .set({
          sampleCount: newSampleCount,
          acceptCount: newAcceptCount,
          dismissCount: newDismissCount,
          tenantCount: newTenantCount,
          agreementRatio: String(newAgreementRatio),
          confidence: String(newConfidence),
          metadata: { ...meta, tenantHashes: newTenantHashes },
          updatedAt: new Date(),
        })
        .where(eq(crossTenantPatterns.id, row.id));
    } else {
      const agreementRatio = isAccepted ? 1.0 : 0.0;
      const confidence = calculateConfidence(1, 1, agreementRatio);

      await tx.insert(crossTenantPatterns).values({
        patternType,
        triggerKey,
        fieldName,
        suggestedValue,
        tenantCount: 1,
        sampleCount: 1,
        acceptCount: isAccepted ? 1 : 0,
        dismissCount: isAccepted ? 0 : 1,
        agreementRatio: String(agreementRatio),
        confidence: String(confidence),
        metadata: { tenantHashes: [tenantHash] },
      });
    }
  });
}

function calculateConfidence(
  tenantCount: number,
  sampleCount: number,
  agreementRatio: number
): number {
  const volumeFactor = Math.min(1.0, Math.log10(tenantCount + 1) / Math.log10(21));
  const sampleFactor = Math.min(1.0, sampleCount / 50);
  const raw = agreementRatio * 0.5 + volumeFactor * 0.3 + sampleFactor * 0.2;
  return Math.round(raw * 100) / 100;
}
```

- [ ] **Step 2: Create cross-tenant engine**

Create `src/lib/services/learning/cross-tenant-engine.ts`:

```typescript
import crypto from "crypto";
import { upsertPattern } from "@/lib/db/queries/cross-tenant-patterns";
import type { PatternOutcome } from "./types";

export function hashTenantId(tenantId: string): string {
  return crypto.createHash("sha256").update(tenantId).digest("hex").slice(0, 8);
}

export async function processCrossTenantOutcome(outcome: PatternOutcome): Promise<void> {
  const isAccepted = outcome.status === "accepted";
  // Only process accepted and dismissed — "edited" counts as dismissed for pattern purposes
  const isRelevant = outcome.status === "accepted" || outcome.status === "dismissed" || outcome.status === "edited";
  if (!isRelevant) return;

  const tenantHash = hashTenantId(outcome.tenantId);

  await upsertPattern({
    patternType: outcome.patternType,
    triggerKey: outcome.triggerKey,
    fieldName: outcome.fieldName,
    suggestedValue: outcome.suggestedValue,
    isAccepted,
    tenantHash,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/learning/cross-tenant-engine.ts src/lib/db/queries/cross-tenant-patterns.ts
git commit -m "feat: add cross-tenant pattern engine with upsert and adaptive thresholds"
```

---

## Task 6: Inngest Event Wiring — Learner → Pattern Engine

**Files:**
- Modify: `src/lib/services/suggestions/types.ts`
- Modify: `src/lib/services/suggestions/learner.ts`
- Create: `src/lib/inngest/functions/update-cross-tenant-pattern.ts`
- Modify: `src/lib/inngest/client.ts` (register function)

- [ ] **Step 1: Add `cross_tenant` source to suggestion types**

In `src/lib/services/suggestions/types.ts`, update the `SuggestionSource` type:

```typescript
// BEFORE:
type SuggestionSource = "vendor_history" | "graduated_rule" | "ai_model" | "frequency"

// AFTER:
type SuggestionSource = "vendor_history" | "graduated_rule" | "ai_model" | "frequency" | "cross_tenant"
```

- [ ] **Step 2: Update learner to emit Inngest event**

In `src/lib/services/suggestions/learner.ts`, add an import and emit an Inngest event after processing outcomes. Add at the top:

```typescript
import { inngest } from "@/lib/inngest/client";
import { normalizeTriggerKey } from "@/lib/services/learning/trigger-keys";
import type { PatternType } from "@/lib/services/learning/types";
```

At the end of the `feedLearner` function, after the existing degradeMatchingRules logic, add:

```typescript
  // Emit cross-tenant pattern events for all outcomes
  const patternEvents = outcomes
    .filter((o) => {
      // Only process suggestion types that map to cross-tenant patterns
      const validTypes: string[] = ["coa_mapping", "wht_rate", "smart_default"];
      return validTypes.includes(o.feature ?? "");
    })
    .map((o) => ({
      name: "suggestion/outcome.processed" as const,
      data: {
        patternType: o.feature as PatternType,
        triggerKey: o.triggerKey ?? "",
        fieldName: o.fieldName ?? "",
        suggestedValue: o.suggestedValue ?? "",
        status: o.status,
        tenantId: o.tenantId ?? "",
      },
    }));

  if (patternEvents.length > 0) {
    await inngest.send(patternEvents);
  }
```

Note: The learner currently receives `SuggestionOutcome[]` which only has `id`, `status`, `finalValue`. We need to enrich it. In the caller (`src/app/api/documents/[id]/route.ts` or the tracking module), join the suggestion data before calling `feedLearner`. Update the `SuggestionOutcome` type to include optional enrichment fields:

```typescript
// In types.ts, update SuggestionOutcome:
export interface SuggestionOutcome {
  id: string;
  status: "accepted" | "dismissed" | "edited";
  finalValue?: string;
  // Enrichment fields for cross-tenant learning (populated by tracking.ts)
  feature?: string;
  fieldName?: string;
  suggestedValue?: string;
  triggerKey?: string;
  tenantId?: string;
}
```

- [ ] **Step 3: Create Inngest handler**

Create `src/lib/inngest/functions/update-cross-tenant-pattern.ts`:

```typescript
import { inngest } from "@/lib/inngest/client";
import { processCrossTenantOutcome } from "@/lib/services/learning/cross-tenant-engine";
import type { PatternOutcome } from "@/lib/services/learning/types";

export const updateCrossTenantPattern = inngest.createFunction(
  { id: "update-cross-tenant-pattern", retries: 3 },
  { event: "suggestion/outcome.processed" },
  async ({ event }) => {
    const outcome = event.data as PatternOutcome;

    if (!outcome.triggerKey || !outcome.fieldName || !outcome.suggestedValue) {
      return { skipped: true, reason: "missing required fields" };
    }

    await processCrossTenantOutcome(outcome);

    return {
      patternType: outcome.patternType,
      triggerKey: outcome.triggerKey,
      status: outcome.status,
    };
  }
);
```

- [ ] **Step 4: Register the Inngest function**

In `src/lib/inngest/client.ts` (or wherever Inngest functions are registered/exported), add:

```typescript
import { updateCrossTenantPattern } from "./functions/update-cross-tenant-pattern";
```

And add `updateCrossTenantPattern` to the functions array exported for the Inngest serve handler.

- [ ] **Step 5: Enrich suggestion outcomes in tracking**

In `src/lib/services/suggestions/tracking.ts` (or wherever suggestion outcomes are processed before calling `feedLearner`), when resolving suggestions, join the original suggestion data to populate the enrichment fields:

```typescript
// When processing batch outcomes, fetch the original suggestions to get feature/field/value/triggerKey:
import { db } from "@/lib/db";
import { aiSuggestions } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

// Fetch original suggestions for enrichment
const suggestionIds = outcomes.map((o) => o.id);
const originalSuggestions = await db
  .select()
  .from(aiSuggestions)
  .where(inArray(aiSuggestions.id, suggestionIds));

// Enrich outcomes
const enrichedOutcomes = outcomes.map((o) => {
  const original = originalSuggestions.find((s) => s.id === o.id);
  return {
    ...o,
    feature: original?.feature,
    fieldName: original?.fieldName,
    suggestedValue: original?.suggestedValue,
    triggerKey: (original?.sourceContext as Record<string, unknown>)?.triggerKey as string | undefined,
    tenantId: original?.tenantId,
  };
});
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/suggestions/types.ts src/lib/services/suggestions/learner.ts src/lib/inngest/functions/update-cross-tenant-pattern.ts src/lib/inngest/client.ts src/lib/services/suggestions/tracking.ts
git commit -m "feat: wire learner to cross-tenant pattern engine via Inngest events"
```

---

## Task 7: Integrate Cross-Tenant Source Into Suggestion Providers

**Files:**
- Modify: `src/lib/services/suggestions/providers/coa-suggester.ts`
- Modify: `src/lib/services/suggestions/providers/wht-suggester.ts`
- Modify: `src/lib/services/suggestions/providers/defaults-suggester.ts`
- Modify: `src/lib/services/suggestions/coordinator.ts`

- [ ] **Step 1: Add cross-tenant lookup to coa-suggester.ts**

Add imports:

```typescript
import { queryCrossTenantPattern } from "@/lib/db/queries/cross-tenant-patterns";
import { normalizeTriggerKey } from "@/lib/services/learning/trigger-keys";
```

Add a new exported function:

```typescript
export async function fromCrossTenant(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const doc = await getDocumentById(documentId);
  if (!doc?.issuerTaxId) return [];

  const triggerKey = normalizeTriggerKey("coa_mapping", doc.issuerTaxId, doc.docType);
  const pattern = await queryCrossTenantPattern({
    patternType: "coa_mapping",
    triggerKey,
    fieldName: "glAccountCode",
  });

  if (!pattern) return [];

  return [
    {
      feature: "coa_mapping",
      fieldName: "glAccountCode",
      suggestedValue: pattern.suggestedValue,
      confidence: pattern.confidence,
      source: "cross_tenant",
      sourceContext: { triggerKey, tenantCount: pattern.tenantCount, sampleCount: pattern.sampleCount },
    },
  ];
}
```

Update the `full()` function to try cross-tenant before AI fallback:

```typescript
export async function full(documentId: string, tenantId: string): Promise<SuggestionResult[]> {
  // 1. Try tenant history first
  const historyResults = await fromHistory(documentId, tenantId);
  if (historyResults.length > 0) return historyResults;

  // 2. Try cross-tenant patterns (NEW)
  const crossTenantResults = await fromCrossTenant(documentId, tenantId);
  if (crossTenantResults.length > 0) return crossTenantResults;

  // 3. AI fallback (existing, most expensive)
  // ... existing AI fallback code ...
}
```

- [ ] **Step 2: Add cross-tenant lookup to wht-suggester.ts**

Add imports:

```typescript
import { queryCrossTenantPattern } from "@/lib/db/queries/cross-tenant-patterns";
import { normalizeTriggerKey } from "@/lib/services/learning/trigger-keys";
```

Add new function:

```typescript
export async function fromCrossTenant(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const doc = await getDocumentById(documentId);
  if (!doc?.issuerTaxId) return [];

  // Look up vendor to get type
  const vendor = await getVendorByTaxId(doc.issuerTaxId, tenantId);
  const vendorType = vendor?.vendorType ?? "company";
  const incomeCategory = doc.whtIncomeType ?? "unknown";

  const triggerKey = normalizeTriggerKey("wht_rate", vendorType, incomeCategory);

  const results: SuggestionResult[] = [];

  // Check for whtRate pattern
  const ratePattern = await queryCrossTenantPattern({
    patternType: "wht_rate",
    triggerKey,
    fieldName: "whtRate",
  });
  if (ratePattern) {
    results.push({
      feature: "wht_rate",
      fieldName: "whtRate",
      suggestedValue: ratePattern.suggestedValue,
      confidence: ratePattern.confidence,
      source: "cross_tenant",
      sourceContext: { triggerKey, tenantCount: ratePattern.tenantCount },
    });
  }

  // Check for whtIncomeType pattern
  const typePattern = await queryCrossTenantPattern({
    patternType: "wht_rate",
    triggerKey,
    fieldName: "whtIncomeType",
  });
  if (typePattern) {
    results.push({
      feature: "wht_rate",
      fieldName: "whtIncomeType",
      suggestedValue: typePattern.suggestedValue,
      confidence: typePattern.confidence,
      source: "cross_tenant",
      sourceContext: { triggerKey, tenantCount: typePattern.tenantCount },
    });
  }

  return results;
}
```

Update `fromVendorType()` to try cross-tenant first:

```typescript
export async function fromVendorType(documentId: string, tenantId: string): Promise<SuggestionResult[]> {
  // 1. Try cross-tenant patterns first (NEW)
  const crossTenantResults = await fromCrossTenant(documentId, tenantId);
  if (crossTenantResults.length > 0) return crossTenantResults;

  // 2. Existing vendor type rules fallback
  // ... existing code ...
}
```

- [ ] **Step 3: Add cross-tenant lookup to defaults-suggester.ts**

Add imports:

```typescript
import { queryCrossTenantPattern } from "@/lib/db/queries/cross-tenant-patterns";
import { normalizeTriggerKey } from "@/lib/services/learning/trigger-keys";
```

Add new function:

```typescript
export async function fromCrossTenant(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const doc = await getDocumentById(documentId);
  if (!doc) return [];

  const fields = ["department", "costCenter", "paymentTerms"];
  const results: SuggestionResult[] = [];

  for (const fieldName of fields) {
    const triggerKey = normalizeTriggerKey("smart_default", doc.docType, fieldName);
    const pattern = await queryCrossTenantPattern({
      patternType: "smart_default",
      triggerKey,
      fieldName,
    });
    if (pattern) {
      results.push({
        feature: "smart_default",
        fieldName,
        suggestedValue: pattern.suggestedValue,
        confidence: pattern.confidence,
        source: "cross_tenant",
        sourceContext: { triggerKey, tenantCount: pattern.tenantCount },
      });
    }
  }

  return results;
}
```

Update `fromHistory()` to fall back to cross-tenant:

At the end of the existing `fromHistory()`, before returning empty results, add:

```typescript
  // If no tenant history, try cross-tenant patterns
  if (results.length === 0) {
    return fromCrossTenant(documentId, tenantId);
  }
```

- [ ] **Step 4: Update coordinator to include triggerKey in sourceContext**

In `src/lib/services/suggestions/coordinator.ts`, when writing suggestions to the database, ensure `sourceContext` includes `triggerKey` so the learner can extract it later for cross-tenant event emission. The providers already return `triggerKey` in `sourceContext` from the new functions — verify this flows through to `insertSuggestions()`.

- [ ] **Step 5: Verify build passes**

Run:
```bash
npx next build
```

Expected: Build succeeds. Cross-tenant source now integrated.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/suggestions/providers/ src/lib/services/suggestions/coordinator.ts
git commit -m "feat: integrate cross-tenant patterns into COA, WHT, and defaults suggesters"
```

---

## Task 8: Onboarding — Industry + Company Size Fields

**Files:**
- Modify: `src/app/(onboarding)/onboarding/workspace/page.tsx`
- Modify: `src/app/api/tenants/[id]/route.ts`

- [ ] **Step 1: Add industry and company size to workspace onboarding step**

In `src/app/(onboarding)/onboarding/workspace/page.tsx`, add two new form fields after the tax ID field.

Add state:

```typescript
const [industry, setIndustry] = useState("");
const [companySize, setCompanySize] = useState("");
```

Add industry dropdown (use existing `Select` component):

```tsx
<div>
  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
    ประเภทธุรกิจ (Industry)
  </label>
  <Select
    value={industry}
    onChange={(value) => setIndustry(value)}
    options={[
      { value: "", label: "เลือกประเภทธุรกิจ" },
      { value: "retail", label: "ค้าปลีก (Retail)" },
      { value: "manufacturing", label: "การผลิต (Manufacturing)" },
      { value: "services", label: "บริการ (Services)" },
      { value: "construction", label: "ก่อสร้าง (Construction)" },
      { value: "hospitality", label: "โรงแรม/ร้านอาหาร (Hospitality)" },
      { value: "healthcare", label: "สุขภาพ (Healthcare)" },
      { value: "education", label: "การศึกษา (Education)" },
      { value: "technology", label: "เทคโนโลยี (Technology)" },
      { value: "other", label: "อื่นๆ (Other)" },
    ]}
  />
</div>
```

Add company size radio group (use existing `RadioGroup` component):

```tsx
<div>
  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
    ขนาดบริษัท (Company Size)
  </label>
  <RadioGroup
    value={companySize}
    onChange={(value) => setCompanySize(value)}
    options={[
      { value: "micro", label: "Micro (1-5 คน)" },
      { value: "small", label: "Small (6-30 คน)" },
      { value: "medium", label: "Medium (31-200 คน)" },
      { value: "large", label: "Large (200+ คน)" },
    ]}
  />
</div>
```

Update the submit handler to include `industry` and `companySize` in the tenant creation/update payload:

```typescript
// In the submit handler, add to the request body:
body: JSON.stringify({
  name: companyName,
  taxId: taxId || undefined,
  industry: industry || undefined,
  companySize: companySize || undefined,
}),
```

Pre-fill from existing tenant data:

```typescript
// In the useEffect that loads existing tenant:
if (tenant) {
  setCompanyName(tenant.name);
  setTaxId(tenant.taxId ?? "");
  setIndustry(tenant.industry ?? "");
  setCompanySize(tenant.companySize ?? "");
}
```

- [ ] **Step 2: Update tenant API to accept industry and companySize**

In `src/app/api/tenants/[id]/route.ts`, update the PUT handler to include the new fields:

```typescript
// In the PUT handler, add to the update object:
industry: body.industry ?? undefined,
companySize: body.companySize ?? undefined,
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(onboarding)/onboarding/workspace/page.tsx src/app/api/tenants/[id]/route.ts
git commit -m "feat: add industry and company size to onboarding and tenant API"
```

---

## Task 9: Onboarding — Suggestion Pills in COA and Partners Steps

**Files:**
- Create: `src/app/api/onboarding/suggestions/route.ts`
- Modify: `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx`
- Modify: `src/app/(onboarding)/onboarding/partners/page.tsx` (if exists, or equivalent vendor step)

- [ ] **Step 1: Create onboarding suggestions API**

Create `src/app/api/onboarding/suggestions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { queryCrossTenantPattern } from "@/lib/db/queries/cross-tenant-patterns";
import { normalizeTriggerKey } from "@/lib/services/learning/trigger-keys";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step");

  if (step === "coa") {
    // Return common GL account mapping suggestions
    const docTypes = ["expense_invoice", "revenue_invoice"];
    const suggestions = [];

    for (const docType of docTypes) {
      const triggerKey = normalizeTriggerKey("coa_mapping", "0000", docType);
      // Query with wildcard-style — get top patterns for any trigger key matching this doc type
      // For onboarding, we query broader patterns (just by docType suffix)
      const pattern = await queryCrossTenantPattern({
        patternType: "coa_mapping",
        triggerKey,
        fieldName: "glAccountCode",
      });
      if (pattern) {
        suggestions.push({
          fieldName: "glAccountCode",
          suggestedValue: pattern.suggestedValue,
          confidence: pattern.confidence,
          context: docType,
        });
      }
    }

    return NextResponse.json({ suggestions });
  }

  if (step === "partners") {
    const vendorTaxIds = searchParams.get("vendorTaxIds")?.split(",").filter(Boolean) ?? [];
    const suggestions = [];

    for (const taxId of vendorTaxIds.slice(0, 10)) {
      const triggerKey = normalizeTriggerKey("wht_rate", "company", "unknown");
      const ratePattern = await queryCrossTenantPattern({
        patternType: "wht_rate",
        triggerKey,
        fieldName: "whtRate",
      });
      if (ratePattern) {
        suggestions.push({
          vendorTaxId: taxId,
          fieldName: "whtRate",
          suggestedValue: ratePattern.suggestedValue,
          confidence: ratePattern.confidence,
        });
      }
    }

    return NextResponse.json({ suggestions });
  }

  return NextResponse.json({ suggestions: [] });
}
```

- [ ] **Step 2: Add suggestion pills to COA onboarding step**

In `src/app/(onboarding)/onboarding/chart-of-accounts/page.tsx`, after the COA template selector, fetch and display suggestions:

```typescript
import { SuggestionPill } from "@/components/suggestion-pill";

// Add state for suggestions
const [coaSuggestions, setCoaSuggestions] = useState<Array<{
  fieldName: string;
  suggestedValue: string;
  confidence: number;
  context: string;
}>>([]);

// Fetch suggestions after template selection
useEffect(() => {
  if (selectedTemplate) {
    fetch(`/api/onboarding/suggestions?step=coa`, {
      headers: { "x-tenant-id": tenantId },
    })
      .then((r) => r.json())
      .then((data) => setCoaSuggestions(data.suggestions ?? []))
      .catch(() => {}); // Non-blocking
  }
}, [selectedTemplate, tenantId]);
```

Render suggestion pills below relevant sections:

```tsx
{coaSuggestions.map((s, i) => (
  <SuggestionPill
    key={i}
    value={`${s.suggestedValue} — commonly used for ${s.context}`}
    confidence={s.confidence}
    onAccept={() => {
      // Apply the suggested GL account mapping
      handleAcceptCoaSuggestion(s);
      setCoaSuggestions((prev) => prev.filter((_, idx) => idx !== i));
    }}
    onDismiss={() => {
      setCoaSuggestions((prev) => prev.filter((_, idx) => idx !== i));
    }}
  />
))}
```

- [ ] **Step 3: Add suggestion pills to partners/vendors onboarding step**

Similar pattern — fetch suggestions when vendor tax IDs are entered, show pills below WHT fields. Follow the same pattern as Step 2 but with `step=partners&vendorTaxIds=xxx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/onboarding/suggestions/ src/app/(onboarding)/onboarding/
git commit -m "feat: add cross-tenant suggestion pills to onboarding COA and partners steps"
```

---

## Task 10: Settings — Industry + Company Size in Workspace Settings

**Files:**
- Modify: `src/app/(app)/settings/workspace/page.tsx` (or equivalent master data settings page)

- [ ] **Step 1: Add industry and company size fields to workspace settings**

Use the same dropdown and radio group pattern as the onboarding step (Task 8). Add after existing fields:

```tsx
<div className="space-y-4">
  <h3 className="text-base font-semibold text-[var(--text-primary)]">
    ข้อมูลบริษัท (Company Info)
  </h3>
  
  <div>
    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
      ประเภทธุรกิจ (Industry)
    </label>
    <Select
      value={industry}
      onChange={(value) => setIndustry(value)}
      options={[
        { value: "", label: "เลือกประเภทธุรกิจ" },
        { value: "retail", label: "ค้าปลีก (Retail)" },
        { value: "manufacturing", label: "การผลิต (Manufacturing)" },
        { value: "services", label: "บริการ (Services)" },
        { value: "construction", label: "ก่อสร้าง (Construction)" },
        { value: "hospitality", label: "โรงแรม/ร้านอาหาร (Hospitality)" },
        { value: "healthcare", label: "สุขภาพ (Healthcare)" },
        { value: "education", label: "การศึกษา (Education)" },
        { value: "technology", label: "เทคโนโลยี (Technology)" },
        { value: "other", label: "อื่นๆ (Other)" },
      ]}
    />
  </div>

  <div>
    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
      ขนาดบริษัท (Company Size)
    </label>
    <RadioGroup
      value={companySize}
      onChange={(value) => setCompanySize(value)}
      options={[
        { value: "micro", label: "Micro (1-5 คน)" },
        { value: "small", label: "Small (6-30 คน)" },
        { value: "medium", label: "Medium (31-200 คน)" },
        { value: "large", label: "Large (200+ คน)" },
      ]}
    />
  </div>
</div>
```

Include `industry` and `companySize` in the save/submit handler that PATCHes the tenant.

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/settings/
git commit -m "feat: add industry and company size to workspace settings"
```

---

## Task 11: Backoffice — Pattern Explorer Page + API

**Files:**
- Create: `src/app/api/backoffice/patterns/route.ts`
- Create: `src/app/api/backoffice/analytics/patterns/route.ts`
- Create: `src/app/(backoffice)/backoffice/patterns/page.tsx`
- Modify: `src/components/backoffice-sidebar.tsx`
- Modify: `src/lib/hooks/use-backoffice.ts`

- [ ] **Step 1: Create pattern list API**

Create `src/app/api/backoffice/patterns/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { crossTenantPatterns } from "@/lib/db/schema";
import { desc, like, eq, gte, count, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const patternType = searchParams.get("patternType");
  const search = searchParams.get("search")?.slice(0, 100);
  const minConfidence = searchParams.get("minConfidence");

  const conditions = [];
  if (patternType) conditions.push(eq(crossTenantPatterns.patternType, patternType));
  if (search) conditions.push(like(crossTenantPatterns.triggerKey, `%${search}%`));
  if (minConfidence) conditions.push(gte(crossTenantPatterns.confidence, minConfidence));

  const where = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(crossTenantPatterns)
      .where(where)
      .orderBy(desc(crossTenantPatterns.confidence))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: count() })
      .from(crossTenantPatterns)
      .where(where),
  ]);

  return NextResponse.json({
    data: rows,
    total: totalResult[0]?.count ?? 0,
    page,
    limit,
  });
}
```

- [ ] **Step 2: Create pattern stats API**

Create `src/app/api/backoffice/analytics/patterns/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, unauthorized, forbidden } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { crossTenantPatterns, aiSuggestions } from "@/lib/db/schema";
import { count, eq, sql, gte } from "drizzle-orm";
import { getMinThresholds, getTotalTenantCount } from "@/lib/db/queries/cross-tenant-patterns";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const totalTenants = await getTotalTenantCount();
  const thresholds = getMinThresholds(totalTenants);

  const [totalPatterns, activePatterns, crossTenantSuggestions, totalSuggestions] = await Promise.all([
    db.select({ count: count() }).from(crossTenantPatterns),
    db
      .select({ count: count() })
      .from(crossTenantPatterns)
      .where(
        sql`${crossTenantPatterns.tenantCount} >= ${thresholds.minTenants} AND ${crossTenantPatterns.agreementRatio} >= ${String(thresholds.minAgreement)}`
      ),
    db
      .select({ count: count() })
      .from(aiSuggestions)
      .where(eq(aiSuggestions.source, "cross_tenant")),
    db.select({ count: count() }).from(aiSuggestions),
  ]);

  const total = totalPatterns[0]?.count ?? 0;
  const active = activePatterns[0]?.count ?? 0;
  const crossTenantCount = crossTenantSuggestions[0]?.count ?? 0;
  const totalCount = totalSuggestions[0]?.count ?? 0;
  const coverage = totalCount > 0 ? Math.round((crossTenantCount / totalCount) * 100) : 0;

  return NextResponse.json({
    totalPatterns: total,
    activePatterns: active,
    coverage,
    thresholds,
  });
}
```

- [ ] **Step 3: Create Pattern Explorer page**

Create `src/app/(backoffice)/backoffice/patterns/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { Select } from "@/components/select";
import { Input } from "@/components/input";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/badge";
import { Database, TrendingUp, BarChart3, Filter } from "lucide-react";

export default function PatternsPage() {
  const [page, setPage] = useState(1);
  const [patternType, setPatternType] = useState("");
  const [search, setSearch] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const limit = 20;

  const { data: stats } = useQuery({
    queryKey: ["backoffice", "pattern-stats"],
    queryFn: () => fetch("/api/backoffice/analytics/patterns").then((r) => r.json()),
  });

  const { data: patterns, isLoading } = useQuery({
    queryKey: ["backoffice", "patterns", page, patternType, search, minConfidence],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (patternType) params.set("patternType", patternType);
      if (search) params.set("search", search);
      if (minConfidence) params.set("minConfidence", minConfidence);
      return fetch(`/api/backoffice/patterns?${params}`).then((r) => r.json());
    },
  });

  const columns = [
    {
      key: "patternType",
      header: "Type",
      render: (row: Record<string, unknown>) => (
        <Badge variant="default">{row.patternType as string}</Badge>
      ),
    },
    { key: "triggerKey", header: "Trigger Key", render: (row: Record<string, unknown>) => (
      <code className="text-xs">{row.triggerKey as string}</code>
    )},
    { key: "fieldName", header: "Field" },
    { key: "suggestedValue", header: "Suggested Value" },
    { key: "tenantCount", header: "Tenants" },
    { key: "sampleCount", header: "Samples" },
    {
      key: "agreementRatio",
      header: "Agreement",
      render: (row: Record<string, unknown>) => {
        const ratio = Number(row.agreementRatio);
        const color = ratio >= 0.8 ? "text-green-600" : ratio >= 0.65 ? "text-blue-600" : "text-amber-600";
        return <span className={`font-medium ${color}`}>{(ratio * 100).toFixed(0)}%</span>;
      },
    },
    {
      key: "confidence",
      header: "Confidence",
      render: (row: Record<string, unknown>) => {
        const conf = Number(row.confidence);
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full"
                style={{ width: `${conf * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums">{conf.toFixed(2)}</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Community Patterns</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Patterns"
          value={stats?.totalPatterns ?? 0}
          icon={Database}
        />
        <StatCard
          title="Active Patterns"
          value={stats?.activePatterns ?? 0}
          subtitle="Meeting quality bar"
          icon={TrendingUp}
        />
        <StatCard
          title="Pattern Coverage"
          value={`${stats?.coverage ?? 0}%`}
          subtitle="of suggestions from cross-tenant"
          icon={BarChart3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-[var(--text-tertiary)]" />
        <Select
          value={patternType}
          onChange={setPatternType}
          options={[
            { value: "", label: "All Types" },
            { value: "coa_mapping", label: "COA Mapping" },
            { value: "wht_rate", label: "WHT Rate" },
            { value: "smart_default", label: "Smart Default" },
          ]}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trigger key..."
          className="max-w-xs"
        />
      </div>

      <DataTable
        columns={columns}
        data={(patterns?.data ?? []) as Record<string, unknown>[]}
        isLoading={isLoading}
      />

      {patterns && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil((patterns.total ?? 0) / limit)}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Patterns nav item to backoffice sidebar**

In `src/components/backoffice-sidebar.tsx`, add to the ANALYTICS group:

```typescript
{ label: "Patterns", href: "/backoffice/patterns", icon: Layers },
```

Add `Layers` to the lucide-react import.

- [ ] **Step 5: Add pattern stats to AI Overview dashboard**

In `src/app/(backoffice)/backoffice/overview/page.tsx`, add a new section below the existing charts. Fetch pattern stats and render 3 StatCards (Active Patterns, Pattern Coverage, AI Calls Saved).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/backoffice/patterns/ src/app/api/backoffice/analytics/patterns/ src/app/(backoffice)/backoffice/patterns/ src/components/backoffice-sidebar.tsx src/app/(backoffice)/backoffice/overview/page.tsx
git commit -m "feat: add backoffice pattern explorer and analytics"
```

---

## Task 12: Final Integration — Build Verification + CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Verify build passes**

Run:
```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Update CLAUDE.md with Phase 6D schema notes**

Add a new section under "Database Schema (Phase 6C)":

```markdown
## Database Schema (Phase 6D)

- `crossTenantPatterns` — anonymized statistical patterns aggregated from suggestion outcomes across all tenants
- `tenants.industry` — business industry category (retail, manufacturing, services, etc.)
- `tenants.companySize` — company size bracket (micro, small, medium, large)
- AI Provider Abstraction: `src/lib/services/ai/` with `AIProvider` interface, `AnthropicProvider`, factory
- Cross-tenant engine: `src/lib/services/learning/` with event-driven pattern updates via Inngest
- Suggestion providers priority: tenant history → graduated rules → cross-tenant patterns → AI fallback
- Cross-tenant suggestions use `source: 'cross_tenant'` (no UI distinction from other sources)
- Trigger keys are normalized (tax ID prefix only, no PII in pattern data)
- Adaptive thresholds: minTenants/minAgreement tighten as platform grows
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Phase 6D schema and architecture notes to CLAUDE.md"
```
