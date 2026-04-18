# Phase 6A: Extraction Accuracy Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace regex-based OCR field extraction with a three-tier AI pipeline (Google Vision raw text → Claude Haiku → Sonnet → Sonnet Vision) that handles any Thai invoice template, adds learned rules from user corrections, and introduces 5 new extraction fields with 4-level amount validation.

**Architecture:** Google Vision stays as the raw text OCR engine. Claude Haiku parses raw text into structured JSON using a base prompt + tenant-specific learned rules. If confidence is low or validation fails, auto-escalate to Claude Sonnet (text), then Claude Sonnet Vision (image). User corrections on the extraction page create/update learned rules in the DB that improve future extractions for the same issuer.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (PostgreSQL), Anthropic SDK (@anthropic-ai/sdk), Inngest (background jobs), Zod v4 (validation), React 19, TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-31-phase6a-extraction-accuracy-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src/lib/services/extraction/types.ts` | Extraction interfaces: ExtractionResult, TierResult, ValidationResult, LearnedRule |
| `src/lib/services/extraction/pipeline.ts` | Main orchestrator: runs tiers, checks escalation, returns best result |
| `src/lib/services/extraction/tiers/tier1-haiku.ts` | Tier 1: call Claude Haiku with raw text + learned rules |
| `src/lib/services/extraction/tiers/tier2-sonnet.ts` | Tier 2: call Claude Sonnet with raw text + Tier 1 failures |
| `src/lib/services/extraction/tiers/tier3-vision.ts` | Tier 3: call Claude Sonnet Vision with image + all prior failures |
| `src/lib/services/extraction/prompts/base-extraction.ts` | Base prompt template with Thai accounting rules |
| `src/lib/services/extraction/prompts/tier2-escalation.ts` | Tier 2 prompt: adds failure context to base |
| `src/lib/services/extraction/prompts/tier3-vision.ts` | Tier 3 prompt: image + raw text + prior results |
| `src/lib/services/extraction/validators/amount-validator.ts` | 4-level amount validation (line item, subtotal, VAT, grand total) |
| `src/lib/services/extraction/validators/field-validator.ts` | Format validators: tax ID, date range, currency, amounts |
| `src/lib/services/extraction/validators/escalation-check.ts` | Decides whether to escalate to next tier |
| `src/lib/services/extraction/rules/rule-loader.ts` | Load matching learned rules from DB at extraction time |
| `src/lib/services/extraction/rules/rule-learner.ts` | Detect user corrections → create/update rules |
| `src/lib/services/extraction/rules/graduated-rules.ts` | Apply high-confidence rules deterministically |
| `src/lib/services/extraction/parsers/response-normalizer.ts` | Normalize Claude JSON → standard extraction schema |
| `src/lib/services/extraction/parsers/date-parser.ts` | Thai Buddhist Era ↔ CE date conversion |
| `src/lib/services/extraction/parsers/number-parser.ts` | Thai number format parsing |
| `src/lib/db/queries/extraction-rules.ts` | CRUD queries for ai_extraction_rules table |
| `src/lib/services/extraction/__tests__/date-parser.test.ts` | Tests for date parsing |
| `src/lib/services/extraction/__tests__/number-parser.test.ts` | Tests for number parsing |
| `src/lib/services/extraction/__tests__/amount-validator.test.ts` | Tests for 4-level validation |
| `src/lib/services/extraction/__tests__/escalation-check.test.ts` | Tests for escalation logic |
| `src/lib/services/extraction/__tests__/field-validator.test.ts` | Tests for format validators |
| `src/lib/services/extraction/__tests__/response-normalizer.test.ts` | Tests for Claude JSON normalization |
| `src/lib/services/extraction/__tests__/rule-learner.test.ts` | Tests for rule learning |
| `src/lib/services/extraction/__tests__/pipeline.test.ts` | Integration tests for pipeline orchestrator |

### Modified Files

| File | Changes |
|---|---|
| `src/lib/db/schema.ts` | Add ai_extraction_rules table, new document columns |
| `src/lib/inngest/functions/process-document.ts` | Replace OCR step with new pipeline, add extraction_status |
| `src/lib/services/ocr.ts` | Keep Google Vision raw text function, remove regex parsing |
| `src/lib/services/confidence.ts` | Add new field weights, recalibrate |
| `src/app/(app)/extractions/page.tsx` | New fields, discount column, validation indicators, retry/manual buttons, remove raw JSON |
| `src/app/api/documents/[id]/route.ts` | Trigger rule learning on PATCH, save new columns |

---

## Task 1: Database Schema — New Columns & Tables

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/queries/extraction-rules.ts`

- [ ] **Step 1: Add new columns to documents table in schema.ts**

In `src/lib/db/schema.ts`, find the documents table definition. Add these columns after the existing `dueDate` column:

```typescript
  // Phase 6A: New extraction fields
  customerTaxId: varchar("customer_tax_id", { length: 13 }),
  referencePo: varchar("reference_po", { length: 100 }),
  creditDueDate: date("credit_due_date"),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).default("0"),

  // Phase 6A: Extraction pipeline tracking
  extractionStatus: text("extraction_status").default("pending"),
  extractionFailureReason: text("extraction_failure_reason"),
```

- [ ] **Step 2: Add ai_extraction_rules table in schema.ts**

After the documents table, add:

```typescript
export const aiExtractionRules = pgTable("ai_extraction_rules", {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  ruleType: text("rule_type").notNull(),
  triggerKey: text("trigger_key").notNull(),
  triggerValue: text("trigger_value").notNull(),
  fieldName: text("field_name").notNull(),
  ruleText: text("rule_text").notNull(),
  deterministicValue: text("deterministic_value"),
  sampleCount: integer("sample_count").default(1).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.50").notNull(),
  isGraduated: boolean("is_graduated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

- [ ] **Step 3: Add relations for ai_extraction_rules**

In the relations section of schema.ts:

```typescript
export const aiExtractionRulesRelations = relations(aiExtractionRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiExtractionRules.tenantId],
    references: [tenants.id],
  }),
}));
```

- [ ] **Step 4: Generate the migration**

Run:
```bash
npx drizzle-kit generate
```

Expected: A new SQL migration file created in `supabase/migrations/` with ALTER TABLE and CREATE TABLE statements.

- [ ] **Step 5: Create extraction-rules queries file**

Create `src/lib/db/queries/extraction-rules.ts`:

```typescript
import { db } from "@/lib/db";
import { aiExtractionRules } from "@/lib/db/schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";

export async function loadRulesForExtraction(
  tenantId: string,
  issuerTaxId: string | null
) {
  const conditions = [
    or(
      eq(aiExtractionRules.tenantId, tenantId),
      isNull(aiExtractionRules.tenantId)
    ),
  ];

  if (issuerTaxId) {
    conditions.push(
      or(
        and(
          eq(aiExtractionRules.triggerKey, "issuer_tax_id"),
          eq(aiExtractionRules.triggerValue, issuerTaxId)
        ),
        eq(aiExtractionRules.triggerKey, "global")
      )
    );
  }

  const rules = await db
    .select()
    .from(aiExtractionRules)
    .where(and(...conditions))
    .orderBy(desc(aiExtractionRules.confidence))
    .limit(20);

  return {
    graduated: rules.filter((r) => r.isGraduated),
    promptRules: rules.filter((r) => !r.isGraduated),
  };
}

export async function upsertExtractionRule(params: {
  tenantId: string;
  ruleType: string;
  triggerKey: string;
  triggerValue: string;
  fieldName: string;
  ruleText: string;
  deterministicValue?: string;
}) {
  const existing = await db
    .select()
    .from(aiExtractionRules)
    .where(
      and(
        eq(aiExtractionRules.tenantId, params.tenantId),
        eq(aiExtractionRules.triggerKey, params.triggerKey),
        eq(aiExtractionRules.triggerValue, params.triggerValue),
        eq(aiExtractionRules.fieldName, params.fieldName)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const rule = existing[0];
    const newConfidence = Math.min(
      0.99,
      Number(rule.confidence) + (1 - Number(rule.confidence)) * 0.15
    );
    const newSampleCount = rule.sampleCount + 1;
    const shouldGraduate = newConfidence > 0.95 && newSampleCount >= 10;

    await db
      .update(aiExtractionRules)
      .set({
        ruleText: params.ruleText,
        deterministicValue: params.deterministicValue ?? rule.deterministicValue,
        sampleCount: newSampleCount,
        confidence: String(newConfidence),
        isGraduated: shouldGraduate,
        updatedAt: new Date(),
      })
      .where(eq(aiExtractionRules.id, rule.id));

    return { action: "updated", ruleId: rule.id, confidence: newConfidence };
  }

  const [newRule] = await db
    .insert(aiExtractionRules)
    .values({
      tenantId: params.tenantId,
      ruleType: params.ruleType,
      triggerKey: params.triggerKey,
      triggerValue: params.triggerValue,
      fieldName: params.fieldName,
      ruleText: params.ruleText,
      deterministicValue: params.deterministicValue,
    })
    .returning({ id: aiExtractionRules.id });

  return { action: "created", ruleId: newRule.id, confidence: 0.5 };
}

export async function degradeRule(ruleId: string) {
  const [rule] = await db
    .select()
    .from(aiExtractionRules)
    .where(eq(aiExtractionRules.id, ruleId))
    .limit(1);

  if (!rule) return;

  const newConfidence = Math.max(0.1, Number(rule.confidence) - 0.2);

  if (newConfidence < 0.2) {
    await db
      .delete(aiExtractionRules)
      .where(eq(aiExtractionRules.id, ruleId));
    return { action: "deleted" };
  }

  await db
    .update(aiExtractionRules)
    .set({
      confidence: String(newConfidence),
      isGraduated: false,
      updatedAt: new Date(),
    })
    .where(eq(aiExtractionRules.id, ruleId));

  return { action: "degraded", confidence: newConfidence };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/queries/extraction-rules.ts supabase/migrations/
git commit -m "feat: add ai_extraction_rules table and new document columns for Phase 6A"
```

---

## Task 2: Extraction Types & Parsers

**Files:**
- Create: `src/lib/services/extraction/types.ts`
- Create: `src/lib/services/extraction/parsers/date-parser.ts`
- Create: `src/lib/services/extraction/parsers/number-parser.ts`
- Create: `src/lib/services/extraction/parsers/response-normalizer.ts`
- Create: `src/lib/services/extraction/__tests__/date-parser.test.ts`
- Create: `src/lib/services/extraction/__tests__/number-parser.test.ts`
- Create: `src/lib/services/extraction/__tests__/response-normalizer.test.ts`

- [ ] **Step 1: Create types.ts**

Create `src/lib/services/extraction/types.ts`:

```typescript
export interface ExtractedIssuer {
  name: string | null;
  tax_id: string | null;
  branch_id: string | null;
  address: string | null;
  postal_code: string | null;
}

export interface ExtractedCustomer {
  name: string | null;
  tax_id: string | null;
  branch_id: string | null;
  address: string | null;
  postal_code: string | null;
}

export interface ExtractedDocument {
  document_type: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  credit_days: number | null;
  credit_due_date: string | null;
  reference_po: string | null;
}

export interface ExtractedAmounts {
  net_amount_ex_vat: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  discount_amount: number | null;
  currency: string;
  is_vat_included: boolean | null;
}

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  discount: number | null;
  total: number | null;
  category: string | null;
}

export interface ExtractionConfidence {
  overall: number;
  weighted: number;
  per_field: Record<string, number>;
}

export interface ExtractedData {
  issuer: ExtractedIssuer;
  customer: ExtractedCustomer;
  document: ExtractedDocument;
  amounts: ExtractedAmounts;
  line_items: ExtractedLineItem[];
  confidence: ExtractionConfidence;
}

export interface LineItemValidation {
  isValid: boolean;
  failures: { index: number; expected: number; got: number }[];
}

export interface AmountCheck {
  isValid: boolean;
  expected: number | null;
  got: number | null;
}

export interface ValidationResult {
  lineItemCheck: LineItemValidation;
  subtotalCheck: AmountCheck;
  vatCheck: AmountCheck;
  grandTotalCheck: AmountCheck;
  overallValid: boolean;
}

export interface TierResult {
  tier: 1 | 2 | 3;
  data: ExtractedData;
  validation: ValidationResult;
  escalationReasons: string[];
  costUsd: number;
}

export interface ExtractionResult {
  data: ExtractedData;
  tierUsed: 1 | 2 | 3;
  allTierResults: TierResult[];
  validation: ValidationResult;
  escalationReasons: string[];
  totalCostUsd: number;
}

export interface LearnedRule {
  id: string;
  tenantId: string | null;
  ruleType: string;
  triggerKey: string;
  triggerValue: string;
  fieldName: string;
  ruleText: string;
  deterministicValue: string | null;
  sampleCount: number;
  confidence: number;
  isGraduated: boolean;
}
```

- [ ] **Step 2: Write date-parser tests**

Create `src/lib/services/extraction/__tests__/date-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseThaiDate } from "../parsers/date-parser";

describe("parseThaiDate", () => {
  it("converts Buddhist Era full year to CE", () => {
    expect(parseThaiDate("2567-08-02")).toBe("2024-08-02");
  });

  it("converts short year D/M/YY (BE) to CE ISO", () => {
    expect(parseThaiDate("2/8/67")).toBe("2024-08-02");
  });

  it("converts short year D/M/YY where YY=24 to 2024 (BE 2567)", () => {
    expect(parseThaiDate("2/8/24")).toBe("2024-08-02");
  });

  it("converts DD/MM/YYYY Buddhist Era", () => {
    expect(parseThaiDate("02/08/2567")).toBe("2024-08-02");
  });

  it("handles already-CE dates in ISO format", () => {
    expect(parseThaiDate("2026-01-06")).toBe("2026-01-06");
  });

  it("handles DD-MM-YYYY with hyphens (BE)", () => {
    expect(parseThaiDate("06-01-2569")).toBe("2026-01-06");
  });

  it("handles date with Thai month name", () => {
    expect(parseThaiDate("6 มกราคม 2569")).toBe("2026-01-06");
  });

  it("handles date with abbreviated Thai month", () => {
    expect(parseThaiDate("6 ม.ค. 2569")).toBe("2026-01-06");
  });

  it("handles date with abbreviated Thai month 67", () => {
    expect(parseThaiDate("6 ม.ค. 67")).toBe("2024-01-06");
  });

  it("returns null for unparseable input", () => {
    expect(parseThaiDate("not a date")).toBeNull();
    expect(parseThaiDate("")).toBeNull();
    expect(parseThaiDate(null as unknown as string)).toBeNull();
  });

  it("strips time component if present", () => {
    expect(parseThaiDate("2026-01-06T10:30:00")).toBe("2026-01-06");
  });

  it("does not produce dates before 2000 CE", () => {
    const result = parseThaiDate("28/2/24");
    expect(result).not.toBeNull();
    const year = parseInt(result!.split("-")[0]);
    expect(year).toBeGreaterThanOrEqual(2000);
  });
});
```

- [ ] **Step 3: Run date-parser tests to verify they fail**

Run: `npx vitest run src/lib/services/extraction/__tests__/date-parser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement date-parser.ts**

Create `src/lib/services/extraction/parsers/date-parser.ts`:

```typescript
const THAI_MONTHS: Record<string, string> = {
  "มกราคม": "01", "ม.ค.": "01", "ม.ค": "01",
  "กุมภาพันธ์": "02", "ก.พ.": "02", "ก.พ": "02",
  "มีนาคม": "03", "มี.ค.": "03", "มี.ค": "03",
  "เมษายน": "04", "เม.ย.": "04", "เม.ย": "04",
  "พฤษภาคม": "05", "พ.ค.": "05", "พ.ค": "05",
  "มิถุนายน": "06", "มิ.ย.": "06", "มิ.ย": "06",
  "กรกฎาคม": "07", "ก.ค.": "07", "ก.ค": "07",
  "สิงหาคม": "08", "ส.ค.": "08", "ส.ค": "08",
  "กันยายน": "09", "ก.ย.": "09", "ก.ย": "09",
  "ตุลาคม": "10", "ต.ค.": "10", "ต.ค": "10",
  "พฤศจิกายน": "11", "พ.ย.": "11", "พ.ย": "11",
  "ธันวาคม": "12", "ธ.ค.": "12", "ธ.ค": "12",
};

function buddhistToGregorian(year: number): number {
  if (year > 2500) return year - 543;
  return year;
}

function resolveShortYear(yy: number): number {
  // Short year: always treat as Buddhist Era for Thai documents
  // yy=67 → 2567 BE → 2024 CE
  // yy=24 → 2567 BE context → 2024 CE (NOT 1924)
  // Rule: if yy <= 99, assume current BE century (25xx)
  const beYear = 2500 + yy;
  return buddhistToGregorian(beYear);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function parseThaiDate(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim().split("T")[0];

  // Pattern 1: ISO format YYYY-MM-DD (could be CE or BE)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = buddhistToGregorian(parseInt(isoMatch[1]));
    return `${year}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Pattern 2: DD/MM/YYYY or DD-MM-YYYY (could be CE or BE)
  const dmyFullMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyFullMatch) {
    const day = parseInt(dmyFullMatch[1]);
    const month = parseInt(dmyFullMatch[2]);
    const year = buddhistToGregorian(parseInt(dmyFullMatch[3]));
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Pattern 3: D/M/YY (short year — Buddhist Era)
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (dmyShortMatch) {
    const day = parseInt(dmyShortMatch[1]);
    const month = parseInt(dmyShortMatch[2]);
    const year = resolveShortYear(parseInt(dmyShortMatch[3]));
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Pattern 4: D ThaiMonth YYYY or D ThaiMonth YY
  for (const [monthName, monthNum] of Object.entries(THAI_MONTHS)) {
    if (trimmed.includes(monthName)) {
      const regex = new RegExp(`(\\d{1,2})\\s*${monthName.replace(".", "\\.")}\\s*(\\d{2,4})`);
      const match = trimmed.match(regex);
      if (match) {
        const day = parseInt(match[1]);
        const rawYear = parseInt(match[2]);
        const year = rawYear <= 99
          ? resolveShortYear(rawYear)
          : buddhistToGregorian(rawYear);
        return `${year}-${monthNum}-${pad(day)}`;
      }
    }
  }

  return null;
}
```

- [ ] **Step 5: Run date-parser tests to verify they pass**

Run: `npx vitest run src/lib/services/extraction/__tests__/date-parser.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Write number-parser tests**

Create `src/lib/services/extraction/__tests__/number-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseThaiNumber } from "../parsers/number-parser";

describe("parseThaiNumber", () => {
  it("parses standard format with period decimal", () => {
    expect(parseThaiNumber("1,750,000.00")).toBe(1750000);
  });

  it("parses Thai format where comma is used for decimal", () => {
    expect(parseThaiNumber("1,750,000,00")).toBe(1750000);
  });

  it("parses number without separators", () => {
    expect(parseThaiNumber("32808")).toBe(32808);
  });

  it("parses number with only decimal", () => {
    expect(parseThaiNumber("122500.00")).toBe(122500);
  });

  it("parses small number", () => {
    expect(parseThaiNumber("7.00")).toBe(7);
  });

  it("handles string with spaces", () => {
    expect(parseThaiNumber(" 1,872,500.00 ")).toBe(1872500);
  });

  it("handles string with currency symbol", () => {
    expect(parseThaiNumber("฿1,750,000.00")).toBe(1750000);
  });

  it("returns null for non-numeric input", () => {
    expect(parseThaiNumber("abc")).toBeNull();
    expect(parseThaiNumber("")).toBeNull();
    expect(parseThaiNumber(null as unknown as string)).toBeNull();
  });

  it("parses negative numbers", () => {
    expect(parseThaiNumber("-1,500.00")).toBe(-1500);
  });

  it("handles ambiguous two-decimal format correctly", () => {
    // "5,015.00" = 5015, NOT 5.015
    expect(parseThaiNumber("5,015.00")).toBe(5015);
  });

  it("handles number with period as thousands (European-style)", () => {
    // "1.750.000,00" — period as thousands, comma as decimal
    expect(parseThaiNumber("1.750.000,00")).toBe(1750000);
  });

  it("passes through already-numeric values", () => {
    expect(parseThaiNumber(1750000 as unknown as string)).toBe(1750000);
  });
});
```

- [ ] **Step 7: Run number-parser tests to verify they fail**

Run: `npx vitest run src/lib/services/extraction/__tests__/number-parser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement number-parser.ts**

Create `src/lib/services/extraction/parsers/number-parser.ts`:

```typescript
export function parseThaiNumber(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return isFinite(input) ? input : null;

  const trimmed = String(input).trim().replace(/^[฿$€£]+/, "").trim();
  if (!trimmed) return null;

  const isNegative = trimmed.startsWith("-");
  const cleaned = trimmed.replace(/^-/, "");

  // Count separators to determine format
  const commas = (cleaned.match(/,/g) || []).length;
  const periods = (cleaned.match(/\./g) || []).length;

  let normalized: string;

  if (periods > 1 && commas <= 1) {
    // European: 1.750.000,00 → periods are thousands, comma is decimal
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (commas > 1 && periods === 0) {
    // Thai ambiguous: 1,750,000,00
    // Last comma group: if exactly 2 digits after last comma, it's decimal
    const lastCommaIdx = cleaned.lastIndexOf(",");
    const afterLast = cleaned.substring(lastCommaIdx + 1);
    if (afterLast.length === 2) {
      // 1,750,000,00 → 1750000.00
      const beforeLast = cleaned.substring(0, lastCommaIdx).replace(/,/g, "");
      normalized = `${beforeLast}.${afterLast}`;
    } else {
      // All commas are thousands separators
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commas >= 1 && periods === 1) {
    // Standard: 1,750,000.00 → commas are thousands, period is decimal
    normalized = cleaned.replace(/,/g, "");
  } else if (commas === 1 && periods === 0) {
    // Ambiguous single comma: 1,500 → thousands OR 1,50 → decimal
    const afterComma = cleaned.split(",")[1];
    if (afterComma.length === 2 && parseInt(cleaned.split(",")[0]) < 1000) {
      // Small number with 2 decimal places: treat comma as decimal
      normalized = cleaned.replace(",", ".");
    } else {
      // Thousands separator
      normalized = cleaned.replace(",", "");
    }
  } else {
    normalized = cleaned;
  }

  const result = parseFloat(normalized);
  if (isNaN(result) || !isFinite(result)) return null;

  return isNegative ? -result : result;
}
```

- [ ] **Step 9: Run number-parser tests to verify they pass**

Run: `npx vitest run src/lib/services/extraction/__tests__/number-parser.test.ts`
Expected: All tests PASS.

- [ ] **Step 10: Write response-normalizer tests**

Create `src/lib/services/extraction/__tests__/response-normalizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeClaudeResponse } from "../parsers/response-normalizer";

describe("normalizeClaudeResponse", () => {
  it("normalizes a complete Claude response", () => {
    const raw = {
      issuer: { name: "Test Co", tax_id: "0123456789012", branch_id: "สำนักงานใหญ่", address: "123 Road", postal_code: "10110" },
      customer: { name: "Buyer Co", tax_id: "9876543210123", branch_id: null, address: null, postal_code: null },
      document: { document_type: "TAX_INVOICE", invoice_number: "INV-001", issue_date: "2567-08-02", due_date: null, credit_days: 30, credit_due_date: null, reference_po: "PO-123" },
      amounts: { net_amount_ex_vat: "1,750,000.00", vat_amount: "122,500.00", total_amount: "1,872,500.00", discount_amount: "0", currency: "THB", is_vat_included: false },
      line_items: [{ description: "Service work", quantity: 1, unit_price: "1,750,000.00", discount: "0", total: "1,750,000.00", category: null }],
      confidence: { overall: 0.85, per_field: { issuer_name: 0.9, total_amount: 0.8 } },
    };

    const result = normalizeClaudeResponse(raw);

    expect(result.issuer.name).toBe("Test Co");
    expect(result.document.issue_date).toBe("2024-08-02");
    expect(result.amounts.net_amount_ex_vat).toBe(1750000);
    expect(result.amounts.vat_amount).toBe(122500);
    expect(result.amounts.total_amount).toBe(1872500);
    expect(result.line_items[0].unit_price).toBe(1750000);
    expect(result.customer.tax_id).toBe("9876543210123");
    expect(result.document.reference_po).toBe("PO-123");
  });

  it("handles null/missing fields gracefully", () => {
    const raw = {};
    const result = normalizeClaudeResponse(raw);
    expect(result.issuer.name).toBeNull();
    expect(result.amounts.currency).toBe("THB");
    expect(result.line_items).toEqual([]);
  });

  it("calculates credit_due_date from issue_date + credit_days", () => {
    const raw = {
      document: { issue_date: "2024-08-02", credit_days: 30, credit_due_date: null },
    };
    const result = normalizeClaudeResponse(raw);
    expect(result.document.credit_due_date).toBe("2024-09-01");
  });
});
```

- [ ] **Step 11: Run response-normalizer tests to verify they fail**

Run: `npx vitest run src/lib/services/extraction/__tests__/response-normalizer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 12: Implement response-normalizer.ts**

Create `src/lib/services/extraction/parsers/response-normalizer.ts`:

```typescript
import { parseThaiDate } from "./date-parser";
import { parseThaiNumber } from "./number-parser";
import type { ExtractedData, ExtractedLineItem } from "../types";

function safeStr(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

function safeNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  return parseThaiNumber(val as string);
}

function addDays(dateStr: string, days: number): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function normalizeClaudeResponse(raw: Record<string, unknown>): ExtractedData {
  const issuerRaw = (raw.issuer || {}) as Record<string, unknown>;
  const customerRaw = (raw.customer || {}) as Record<string, unknown>;
  const docRaw = (raw.document || {}) as Record<string, unknown>;
  const amountsRaw = (raw.amounts || {}) as Record<string, unknown>;
  const lineItemsRaw = (raw.line_items || []) as Record<string, unknown>[];
  const confidenceRaw = (raw.confidence || {}) as Record<string, unknown>;

  const issueDate = parseThaiDate(safeStr(docRaw.issue_date) ?? "");
  const creditDays = safeNum(docRaw.credit_days);
  let creditDueDate = parseThaiDate(safeStr(docRaw.credit_due_date) ?? "");
  if (!creditDueDate && issueDate && creditDays && creditDays > 0) {
    creditDueDate = addDays(issueDate, creditDays);
  }

  const lineItems: ExtractedLineItem[] = lineItemsRaw.map((li) => ({
    description: safeStr(li.description) ?? "",
    quantity: safeNum(li.quantity),
    unit_price: safeNum(li.unit_price),
    discount: safeNum(li.discount),
    total: safeNum(li.total),
    category: safeStr(li.category),
  }));

  const perField = (confidenceRaw.per_field || {}) as Record<string, number>;
  const overall = typeof confidenceRaw.overall === "number" ? confidenceRaw.overall : 0.5;

  // Calculate weighted confidence using field weights
  const weights: Record<string, number> = {
    issuer_tax_id: 3.0, vat_amount: 3.0, document_type: 2.0,
    issuer_name: 1.5, invoice_date: 1.5, invoice_number: 1.0,
    total_amount: 1.0, net_amount_ex_vat: 0.5,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [field, weight] of Object.entries(weights)) {
    const conf = perField[field] ?? 0.3;
    weightedSum += conf * weight;
    totalWeight += weight;
  }
  const weighted = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10000) / 10000 : 0.5;

  return {
    issuer: {
      name: safeStr(issuerRaw.name),
      tax_id: safeStr(issuerRaw.tax_id),
      branch_id: safeStr(issuerRaw.branch_id),
      address: safeStr(issuerRaw.address),
      postal_code: safeStr(issuerRaw.postal_code),
    },
    customer: {
      name: safeStr(customerRaw.name),
      tax_id: safeStr(customerRaw.tax_id),
      branch_id: safeStr(customerRaw.branch_id),
      address: safeStr(customerRaw.address),
      postal_code: safeStr(customerRaw.postal_code),
    },
    document: {
      document_type: safeStr(docRaw.document_type),
      invoice_number: safeStr(docRaw.invoice_number),
      issue_date: issueDate,
      due_date: parseThaiDate(safeStr(docRaw.due_date) ?? ""),
      credit_days: creditDays,
      credit_due_date: creditDueDate,
      reference_po: safeStr(docRaw.reference_po),
    },
    amounts: {
      net_amount_ex_vat: safeNum(amountsRaw.net_amount_ex_vat),
      vat_amount: safeNum(amountsRaw.vat_amount),
      total_amount: safeNum(amountsRaw.total_amount),
      discount_amount: safeNum(amountsRaw.discount_amount),
      currency: safeStr(amountsRaw.currency) ?? "THB",
      is_vat_included: amountsRaw.is_vat_included as boolean | null ?? null,
    },
    line_items: lineItems,
    confidence: {
      overall,
      weighted,
      per_field: perField,
    },
  };
}
```

- [ ] **Step 13: Run all parser tests**

Run: `npx vitest run src/lib/services/extraction/__tests__/`
Expected: All tests PASS.

- [ ] **Step 14: Commit**

```bash
git add src/lib/services/extraction/
git commit -m "feat: add extraction types, date/number parsers, and response normalizer with tests"
```

---

## Task 3: Validators — Amount Validation, Field Validation, Escalation Check

**Files:**
- Create: `src/lib/services/extraction/validators/amount-validator.ts`
- Create: `src/lib/services/extraction/validators/field-validator.ts`
- Create: `src/lib/services/extraction/validators/escalation-check.ts`
- Create: `src/lib/services/extraction/__tests__/amount-validator.test.ts`
- Create: `src/lib/services/extraction/__tests__/field-validator.test.ts`
- Create: `src/lib/services/extraction/__tests__/escalation-check.test.ts`

- [ ] **Step 1: Write amount-validator tests**

Create `src/lib/services/extraction/__tests__/amount-validator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateAmounts } from "../validators/amount-validator";
import type { ExtractedAmounts, ExtractedLineItem } from "../types";

describe("validateAmounts", () => {
  const validLineItems: ExtractedLineItem[] = [
    { description: "Item 1", quantity: 2, unit_price: 100, discount: 0, total: 200, category: null },
    { description: "Item 2", quantity: 1, unit_price: 500, discount: 50, total: 450, category: null },
  ];

  const validAmounts: ExtractedAmounts = {
    net_amount_ex_vat: 650,
    vat_amount: 45.5,
    total_amount: 695.5,
    discount_amount: 0,
    currency: "THB",
    is_vat_included: false,
  };

  it("passes all checks for valid data", () => {
    const result = validateAmounts(validAmounts, validLineItems);
    expect(result.overallValid).toBe(true);
    expect(result.lineItemCheck.isValid).toBe(true);
    expect(result.subtotalCheck.isValid).toBe(true);
    expect(result.vatCheck.isValid).toBe(true);
    expect(result.grandTotalCheck.isValid).toBe(true);
  });

  it("detects line item math error", () => {
    const badItems: ExtractedLineItem[] = [
      { description: "Item", quantity: 2, unit_price: 100, discount: 0, total: 999, category: null },
    ];
    const result = validateAmounts({ ...validAmounts, net_amount_ex_vat: 999 }, badItems);
    expect(result.lineItemCheck.isValid).toBe(false);
    expect(result.lineItemCheck.failures[0].index).toBe(0);
  });

  it("detects subtotal mismatch", () => {
    const result = validateAmounts({ ...validAmounts, net_amount_ex_vat: 1000 }, validLineItems);
    expect(result.subtotalCheck.isValid).toBe(false);
  });

  it("detects VAT mismatch", () => {
    const result = validateAmounts({ ...validAmounts, vat_amount: 999 }, validLineItems);
    expect(result.vatCheck.isValid).toBe(false);
  });

  it("detects grand total mismatch", () => {
    const result = validateAmounts({ ...validAmounts, total_amount: 999 }, validLineItems);
    expect(result.grandTotalCheck.isValid).toBe(false);
  });

  it("handles null amounts gracefully", () => {
    const nullAmounts: ExtractedAmounts = {
      net_amount_ex_vat: null, vat_amount: null, total_amount: null,
      discount_amount: null, currency: "THB", is_vat_included: null,
    };
    const result = validateAmounts(nullAmounts, []);
    expect(result.lineItemCheck.isValid).toBe(true);
    expect(result.subtotalCheck.isValid).toBe(true);
    expect(result.vatCheck.isValid).toBe(true);
    expect(result.grandTotalCheck.isValid).toBe(true);
    expect(result.overallValid).toBe(true);
  });

  it("accounts for invoice-level discount in subtotal check", () => {
    const amounts: ExtractedAmounts = {
      net_amount_ex_vat: 600,
      vat_amount: 42,
      total_amount: 642,
      discount_amount: 50,
      currency: "THB",
      is_vat_included: false,
    };
    const result = validateAmounts(amounts, validLineItems);
    expect(result.subtotalCheck.isValid).toBe(true);
  });
});
```

- [ ] **Step 2: Run amount-validator tests to verify they fail**

Run: `npx vitest run src/lib/services/extraction/__tests__/amount-validator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement amount-validator.ts**

Create `src/lib/services/extraction/validators/amount-validator.ts`:

```typescript
import type { ExtractedAmounts, ExtractedLineItem, ValidationResult } from "../types";

const TOLERANCE = 1.0;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

export function validateAmounts(
  amounts: ExtractedAmounts,
  lineItems: ExtractedLineItem[]
): ValidationResult {
  // Level 1: Line item check — qty × unit_price - discount ≈ total
  const lineFailures: { index: number; expected: number; got: number }[] = [];
  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    if (li.quantity != null && li.unit_price != null && li.total != null) {
      const expected = li.quantity * li.unit_price - (li.discount ?? 0);
      if (!approxEqual(expected, li.total)) {
        lineFailures.push({ index: i, expected, got: li.total });
      }
    }
  }
  const lineItemCheck = { isValid: lineFailures.length === 0, failures: lineFailures };

  // Level 2: Subtotal check — sum(item_totals) - invoice_discount ≈ subtotal
  let subtotalCheck = { isValid: true, expected: null as number | null, got: amounts.net_amount_ex_vat };
  if (amounts.net_amount_ex_vat != null && lineItems.length > 0) {
    const lineItemsWithTotals = lineItems.filter((li) => li.total != null);
    if (lineItemsWithTotals.length > 0) {
      const sumTotals = lineItemsWithTotals.reduce((sum, li) => sum + (li.total ?? 0), 0);
      const expected = sumTotals - (amounts.discount_amount ?? 0);
      subtotalCheck = {
        isValid: approxEqual(expected, amounts.net_amount_ex_vat),
        expected,
        got: amounts.net_amount_ex_vat,
      };
    }
  }

  // Level 3: VAT check — subtotal × 0.07 ≈ vat_amount (if normal VAT and both present)
  let vatCheck = { isValid: true, expected: null as number | null, got: amounts.vat_amount };
  if (amounts.net_amount_ex_vat != null && amounts.vat_amount != null && amounts.vat_amount > 0) {
    const expectedVat = Math.round(amounts.net_amount_ex_vat * 0.07 * 100) / 100;
    vatCheck = {
      isValid: approxEqual(expectedVat, amounts.vat_amount),
      expected: expectedVat,
      got: amounts.vat_amount,
    };
  }

  // Level 4: Grand total check — subtotal + vat ≈ total
  let grandTotalCheck = { isValid: true, expected: null as number | null, got: amounts.total_amount };
  if (amounts.net_amount_ex_vat != null && amounts.total_amount != null) {
    const expectedTotal = amounts.net_amount_ex_vat + (amounts.vat_amount ?? 0);
    grandTotalCheck = {
      isValid: approxEqual(expectedTotal, amounts.total_amount),
      expected: expectedTotal,
      got: amounts.total_amount,
    };
  }

  return {
    lineItemCheck,
    subtotalCheck,
    vatCheck,
    grandTotalCheck,
    overallValid: lineItemCheck.isValid && subtotalCheck.isValid && vatCheck.isValid && grandTotalCheck.isValid,
  };
}
```

- [ ] **Step 4: Run amount-validator tests**

Run: `npx vitest run src/lib/services/extraction/__tests__/amount-validator.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Write field-validator tests**

Create `src/lib/services/extraction/__tests__/field-validator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateFields } from "../validators/field-validator";

describe("validateFields", () => {
  it("validates correct tax ID", () => {
    const result = validateFields({ tax_id: "0145555002610" });
    expect(result.tax_id.isValid).toBe(true);
  });

  it("rejects invalid tax ID (wrong length)", () => {
    const result = validateFields({ tax_id: "12345" });
    expect(result.tax_id.isValid).toBe(false);
  });

  it("rejects tax ID with non-digits", () => {
    const result = validateFields({ tax_id: "01455550026XX" });
    expect(result.tax_id.isValid).toBe(false);
  });

  it("validates date in acceptable CE range", () => {
    const result = validateFields({ issue_date: "2025-06-15" });
    expect(result.issue_date.isValid).toBe(true);
  });

  it("rejects date before 2000", () => {
    const result = validateFields({ issue_date: "1902-08-24" });
    expect(result.issue_date.isValid).toBe(false);
  });

  it("rejects date after 2030", () => {
    const result = validateFields({ issue_date: "2035-01-01" });
    expect(result.issue_date.isValid).toBe(false);
  });

  it("validates known currency", () => {
    const result = validateFields({ currency: "THB" });
    expect(result.currency.isValid).toBe(true);
  });

  it("rejects unknown currency", () => {
    const result = validateFields({ currency: "XYZ" });
    expect(result.currency.isValid).toBe(false);
  });

  it("validates non-negative amounts", () => {
    const result = validateFields({ amount: 1500 });
    expect(result.amount.isValid).toBe(true);
  });

  it("rejects negative amounts", () => {
    const result = validateFields({ amount: -100 });
    expect(result.amount.isValid).toBe(false);
  });

  it("handles null values as valid (not present)", () => {
    const result = validateFields({ tax_id: null, issue_date: null });
    expect(result.tax_id.isValid).toBe(true);
    expect(result.issue_date.isValid).toBe(true);
  });
});
```

- [ ] **Step 6: Implement field-validator.ts**

Create `src/lib/services/extraction/validators/field-validator.ts`:

```typescript
interface FieldValidation {
  isValid: boolean;
  reason?: string;
}

const VALID_CURRENCIES = new Set([
  "THB", "USD", "EUR", "GBP", "JPY", "CNY", "SGD", "HKD", "KRW", "AUD",
  "MYR", "IDR", "PHP", "VND", "TWD", "INR", "CHF", "CAD", "NZD",
]);

export function validateFields(fields: Record<string, unknown>): Record<string, FieldValidation> {
  const result: Record<string, FieldValidation> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      result[key] = { isValid: true };
      continue;
    }

    switch (key) {
      case "tax_id": {
        const str = String(value);
        const isValid = /^\d{13}$/.test(str);
        result[key] = { isValid, reason: isValid ? undefined : "Tax ID must be exactly 13 digits" };
        break;
      }
      case "issue_date":
      case "due_date":
      case "credit_due_date": {
        const str = String(value);
        const yearMatch = str.match(/^(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          const isValid = year >= 2000 && year <= 2030;
          result[key] = { isValid, reason: isValid ? undefined : `Year ${year} outside valid range 2000-2030` };
        } else {
          result[key] = { isValid: false, reason: "Invalid date format" };
        }
        break;
      }
      case "currency": {
        const isValid = VALID_CURRENCIES.has(String(value).toUpperCase());
        result[key] = { isValid, reason: isValid ? undefined : `Unknown currency: ${value}` };
        break;
      }
      case "amount":
      case "vat_amount":
      case "total_amount":
      case "net_amount_ex_vat":
      case "discount_amount": {
        const num = Number(value);
        const isValid = isFinite(num) && num >= 0;
        result[key] = { isValid, reason: isValid ? undefined : "Amount must be non-negative" };
        break;
      }
      default:
        result[key] = { isValid: true };
    }
  }

  return result;
}
```

- [ ] **Step 7: Run field-validator tests**

Run: `npx vitest run src/lib/services/extraction/__tests__/field-validator.test.ts`
Expected: All tests PASS.

- [ ] **Step 8: Write escalation-check tests**

Create `src/lib/services/extraction/__tests__/escalation-check.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldEscalate } from "../validators/escalation-check";
import type { ExtractedData, ValidationResult } from "../types";

const passingValidation: ValidationResult = {
  lineItemCheck: { isValid: true, failures: [] },
  subtotalCheck: { isValid: true, expected: 100, got: 100 },
  vatCheck: { isValid: true, expected: 7, got: 7 },
  grandTotalCheck: { isValid: true, expected: 107, got: 107 },
  overallValid: true,
};

const highConfidence: ExtractedData = {
  issuer: { name: "Test", tax_id: "0123456789012", branch_id: null, address: null, postal_code: null },
  customer: { name: null, tax_id: null, branch_id: null, address: null, postal_code: null },
  document: { document_type: "TAX_INVOICE", invoice_number: "INV-1", issue_date: "2024-01-01", due_date: null, credit_days: null, credit_due_date: null, reference_po: null },
  amounts: { net_amount_ex_vat: 100, vat_amount: 7, total_amount: 107, discount_amount: 0, currency: "THB", is_vat_included: false },
  line_items: [],
  confidence: { overall: 0.85, weighted: 0.82, per_field: { issuer_tax_id: 0.9, total_amount: 0.8, vat_amount: 0.8, invoice_number: 0.7, issue_date: 0.8 } },
};

describe("shouldEscalate", () => {
  it("returns false when confidence is high and validation passes", () => {
    expect(shouldEscalate(highConfidence, passingValidation)).toBe(false);
  });

  it("returns true when weighted confidence < 0.70", () => {
    const low = { ...highConfidence, confidence: { ...highConfidence.confidence, weighted: 0.65 } };
    expect(shouldEscalate(low, passingValidation)).toBe(true);
  });

  it("returns true when critical field confidence < 0.50", () => {
    const lowField = {
      ...highConfidence,
      confidence: { ...highConfidence.confidence, per_field: { ...highConfidence.confidence.per_field, issuer_tax_id: 0.3 } },
    };
    expect(shouldEscalate(lowField, passingValidation)).toBe(true);
  });

  it("returns true when amount validation fails", () => {
    const failedValidation = { ...passingValidation, grandTotalCheck: { isValid: false, expected: 107, got: 999 }, overallValid: false };
    expect(shouldEscalate(highConfidence, failedValidation)).toBe(true);
  });

  it("returns escalation reasons", () => {
    const low = { ...highConfidence, confidence: { ...highConfidence.confidence, weighted: 0.5, per_field: { ...highConfidence.confidence.per_field, invoice_number: 0.3 } } };
    const failedVal = { ...passingValidation, vatCheck: { isValid: false, expected: 7, got: 999 }, overallValid: false };
    const { reasons } = shouldEscalate(low, failedVal, true);
    expect(reasons).toContain("weighted_confidence_0.5");
    expect(reasons).toContain("low_field:invoice_number=0.3");
    expect(reasons).toContain("vat_check_failed");
  });
});
```

- [ ] **Step 9: Implement escalation-check.ts**

Create `src/lib/services/extraction/validators/escalation-check.ts`:

```typescript
import type { ExtractedData, ValidationResult } from "../types";

const CRITICAL_FIELDS = [
  "issuer_tax_id",
  "total_amount",
  "vat_amount",
  "invoice_number",
  "issue_date",
];

const CONFIDENCE_THRESHOLD = 0.70;
const CRITICAL_FIELD_THRESHOLD = 0.50;

export function shouldEscalate(
  data: ExtractedData,
  validation: ValidationResult,
  withReasons?: true
): { escalate: boolean; reasons: string[] };
export function shouldEscalate(
  data: ExtractedData,
  validation: ValidationResult,
  withReasons?: false
): boolean;
export function shouldEscalate(
  data: ExtractedData,
  validation: ValidationResult,
  withReasons = false
): boolean | { escalate: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (data.confidence.weighted < CONFIDENCE_THRESHOLD) {
    reasons.push(`weighted_confidence_${data.confidence.weighted}`);
  }

  for (const field of CRITICAL_FIELDS) {
    const conf = data.confidence.per_field[field] ?? 0;
    if (conf < CRITICAL_FIELD_THRESHOLD) {
      reasons.push(`low_field:${field}=${conf}`);
    }
  }

  if (!validation.lineItemCheck.isValid) reasons.push("line_item_check_failed");
  if (!validation.subtotalCheck.isValid) reasons.push("subtotal_check_failed");
  if (!validation.vatCheck.isValid) reasons.push("vat_check_failed");
  if (!validation.grandTotalCheck.isValid) reasons.push("grand_total_check_failed");

  const escalate = reasons.length > 0;

  if (withReasons) return { escalate, reasons };
  return escalate;
}
```

- [ ] **Step 10: Run all validator tests**

Run: `npx vitest run src/lib/services/extraction/__tests__/`
Expected: All tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/services/extraction/validators/ src/lib/services/extraction/__tests__/
git commit -m "feat: add 4-level amount validation, field validators, and escalation logic with tests"
```

---

## Task 4: Prompts & Tier Implementations

**Files:**
- Create: `src/lib/services/extraction/prompts/base-extraction.ts`
- Create: `src/lib/services/extraction/prompts/tier2-escalation.ts`
- Create: `src/lib/services/extraction/prompts/tier3-vision.ts`
- Create: `src/lib/services/extraction/tiers/tier1-haiku.ts`
- Create: `src/lib/services/extraction/tiers/tier2-sonnet.ts`
- Create: `src/lib/services/extraction/tiers/tier3-vision.ts`

- [ ] **Step 1: Create base-extraction prompt**

Create `src/lib/services/extraction/prompts/base-extraction.ts`:

```typescript
import type { LearnedRule } from "../types";

const BASE_PROMPT = `You are a Thai accounting document parser. Extract structured data from the OCR text below.

## Rules
- Dates: Thai Buddhist Era (พ.ศ.) subtract 543 for CE. Short year "67" = 2567 BE = 2024 CE. "24" on a recent document = 2567 BE = 2024 CE, NOT 1924. Output ISO format YYYY-MM-DD.
- Numbers: Thai invoices use mixed formats. "1,750,000.00" and "1,750,000,00" both mean 1.75 million. Use context to determine decimal point.
- Tax ID: Always 13 digits. Near "เลขประจำตัวผู้เสียภาษี" or "TAX ID". Not a price.
- Invoice number: The document's own number, NOT the word "INVOICE". Look for "เลขที่" or "#" or "No." followed by the actual number.
- VAT: Thailand rate is 7%. Extract the AMOUNT, not "7".
- Currency: Default THB unless stated otherwise.
- Discount: May appear at item level AND invoice level separately.
- Branch: "สำนักงานใหญ่" = Head Office (branch "00000" or "สำนักงานใหญ่"). "สาขา" followed by number = branch number.
- Issuer = seller/provider. Customer = buyer/recipient.

## Output
Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "issuer": { "name": string|null, "tax_id": string|null, "branch_id": string|null, "address": string|null, "postal_code": string|null },
  "customer": { "name": string|null, "tax_id": string|null, "branch_id": string|null, "address": string|null, "postal_code": string|null },
  "document": { "document_type": string|null, "invoice_number": string|null, "issue_date": string|null, "due_date": string|null, "credit_days": number|null, "credit_due_date": string|null, "reference_po": string|null },
  "amounts": { "net_amount_ex_vat": number|null, "vat_amount": number|null, "total_amount": number|null, "discount_amount": number|null, "currency": string, "is_vat_included": boolean|null },
  "line_items": [{ "description": string, "quantity": number|null, "unit_price": number|null, "discount": number|null, "total": number|null, "category": string|null }],
  "confidence": { "overall": number, "per_field": { "issuer_name": number, "issuer_tax_id": number, "invoice_number": number, "invoice_date": number, "total_amount": number, "vat_amount": number, "subtotal": number } }
}

Confidence: 0.0 = missing/guessing, 0.5 = partial, 0.8 = clear, 1.0 = certain.`;

export function buildBasePrompt(rawText: string, rules: LearnedRule[]): string {
  let prompt = BASE_PROMPT;

  if (rules.length > 0) {
    const rulesBlock = rules
      .map((r) => `- [${r.fieldName}] ${r.ruleText} (confidence: ${r.confidence})`)
      .join("\n");
    prompt += `\n\n## Learned Rules (from prior corrections for this issuer)\n${rulesBlock}`;
  }

  prompt += `\n\n## OCR Text\n${rawText}`;

  return prompt;
}

export function buildTier2Prompt(
  rawText: string,
  rules: LearnedRule[],
  tier1Result: Record<string, unknown>,
  escalationReasons: string[]
): string {
  let prompt = buildBasePrompt(rawText, rules);

  prompt += `\n\n## Previous Extraction Attempt (failed validation)\n${JSON.stringify(tier1Result, null, 2)}`;
  prompt += `\n\n## Issues Found\n${escalationReasons.map((r) => `- ${r}`).join("\n")}`;
  prompt += `\n\nPlease re-extract with special attention to the flagged issues.`;

  return prompt;
}

export function buildTier3Prompt(
  rawText: string,
  rules: LearnedRule[],
  tier1Result: Record<string, unknown>,
  tier2Result: Record<string, unknown>,
  escalationReasons: string[]
): string {
  const baseRules = BASE_PROMPT;

  let prompt = `You are a Thai accounting document parser. Extract structured data from this document IMAGE.\nYou also have raw OCR text from Google Vision as reference — cross-check your visual reading.\n\n`;
  prompt += baseRules.split("## Output")[1] ? `## Output${baseRules.split("## Output")[1]}` : "";
  prompt += `\n\n## Google Vision Raw Text (reference)\n${rawText}`;

  if (rules.length > 0) {
    const rulesBlock = rules
      .map((r) => `- [${r.fieldName}] ${r.ruleText} (confidence: ${r.confidence})`)
      .join("\n");
    prompt += `\n\n## Learned Rules\n${rulesBlock}`;
  }

  prompt += `\n\n## Previous Attempts\nTier 1: ${JSON.stringify(tier1Result)}\nTier 2: ${JSON.stringify(tier2Result)}`;
  prompt += `\n\n## Issues\n${escalationReasons.map((r) => `- ${r}`).join("\n")}`;

  return prompt;
}
```

- [ ] **Step 2: Implement tier1-haiku.ts**

Create `src/lib/services/extraction/tiers/tier1-haiku.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { buildBasePrompt } from "../prompts/base-extraction";
import { normalizeClaudeResponse } from "../parsers/response-normalizer";
import { validateAmounts } from "../validators/amount-validator";
import type { TierResult, LearnedRule } from "../types";

const anthropic = new Anthropic();

export async function extractTier1(
  rawText: string,
  rules: LearnedRule[]
): Promise<TierResult> {
  const prompt = buildBasePrompt(rawText, rules);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const data = normalizeClaudeResponse(parsed);
  const validation = validateAmounts(data.amounts, data.line_items);

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const costUsd = (inputTokens * 0.8 + outputTokens * 4) / 1_000_000;

  return {
    tier: 1,
    data,
    validation,
    escalationReasons: [],
    costUsd,
  };
}
```

- [ ] **Step 3: Implement tier2-sonnet.ts**

Create `src/lib/services/extraction/tiers/tier2-sonnet.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { buildTier2Prompt } from "../prompts/base-extraction";
import { normalizeClaudeResponse } from "../parsers/response-normalizer";
import { validateAmounts } from "../validators/amount-validator";
import type { TierResult, LearnedRule, ExtractedData } from "../types";

const anthropic = new Anthropic();

export async function extractTier2(
  rawText: string,
  rules: LearnedRule[],
  tier1Data: ExtractedData,
  tier1Reasons: string[]
): Promise<TierResult> {
  const prompt = buildTier2Prompt(rawText, rules, tier1Data as unknown as Record<string, unknown>, tier1Reasons);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const data = normalizeClaudeResponse(parsed);
  const validation = validateAmounts(data.amounts, data.line_items);

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  return {
    tier: 2,
    data,
    validation,
    escalationReasons: tier1Reasons,
    costUsd,
  };
}
```

- [ ] **Step 4: Implement tier3-vision.ts**

Create `src/lib/services/extraction/tiers/tier3-vision.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { buildTier3Prompt } from "../prompts/base-extraction";
import { normalizeClaudeResponse } from "../parsers/response-normalizer";
import { validateAmounts } from "../validators/amount-validator";
import type { TierResult, LearnedRule, ExtractedData } from "../types";

const anthropic = new Anthropic();

export async function extractTier3(
  imageBase64: string,
  mimeType: string,
  rawText: string,
  rules: LearnedRule[],
  tier1Data: ExtractedData,
  tier2Data: ExtractedData,
  escalationReasons: string[]
): Promise<TierResult> {
  const textPrompt = buildTier3Prompt(
    rawText,
    rules,
    tier1Data as unknown as Record<string, unknown>,
    tier2Data as unknown as Record<string, unknown>,
    escalationReasons
  );

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: imageBase64,
            },
          },
          { type: "text", text: textPrompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const data = normalizeClaudeResponse(parsed);
  const validation = validateAmounts(data.amounts, data.line_items);

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  return {
    tier: 3,
    data,
    validation,
    escalationReasons,
    costUsd,
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/extraction/prompts/ src/lib/services/extraction/tiers/
git commit -m "feat: add extraction prompts and three-tier implementations (Haiku/Sonnet/Vision)"
```

---

## Task 5: Rule Loader, Rule Learner, Graduated Rules

**Files:**
- Create: `src/lib/services/extraction/rules/rule-loader.ts`
- Create: `src/lib/services/extraction/rules/rule-learner.ts`
- Create: `src/lib/services/extraction/rules/graduated-rules.ts`
- Create: `src/lib/services/extraction/__tests__/rule-learner.test.ts`

- [ ] **Step 1: Implement rule-loader.ts**

Create `src/lib/services/extraction/rules/rule-loader.ts`:

```typescript
import { loadRulesForExtraction } from "@/lib/db/queries/extraction-rules";
import type { LearnedRule } from "../types";

export async function loadRules(
  tenantId: string,
  rawText: string
): Promise<{ promptRules: LearnedRule[]; graduated: LearnedRule[] }> {
  // Extract potential issuer tax ID from raw text (simple 13-digit match)
  const taxIdMatch = rawText.match(/\d{13}/);
  const issuerTaxId = taxIdMatch ? taxIdMatch[0] : null;

  const result = await loadRulesForExtraction(tenantId, issuerTaxId);

  return {
    promptRules: result.promptRules.map(mapToLearnedRule),
    graduated: result.graduated.map(mapToLearnedRule),
  };
}

function mapToLearnedRule(row: {
  id: string;
  tenantId: string | null;
  ruleType: string;
  triggerKey: string;
  triggerValue: string;
  fieldName: string;
  ruleText: string;
  deterministicValue: string | null;
  sampleCount: number;
  confidence: string;
  isGraduated: boolean;
}): LearnedRule {
  return {
    id: row.id,
    tenantId: row.tenantId,
    ruleType: row.ruleType,
    triggerKey: row.triggerKey,
    triggerValue: row.triggerValue,
    fieldName: row.fieldName,
    ruleText: row.ruleText,
    deterministicValue: row.deterministicValue,
    sampleCount: row.sampleCount,
    confidence: Number(row.confidence),
    isGraduated: row.isGraduated,
  };
}
```

- [ ] **Step 2: Implement graduated-rules.ts**

Create `src/lib/services/extraction/rules/graduated-rules.ts`:

```typescript
import type { ExtractedData, LearnedRule } from "../types";

export function applyGraduatedRules(
  data: ExtractedData,
  graduatedRules: LearnedRule[]
): ExtractedData {
  if (graduatedRules.length === 0) return data;

  // Deep clone to avoid mutation
  const result: ExtractedData = JSON.parse(JSON.stringify(data));

  for (const rule of graduatedRules) {
    if (!rule.deterministicValue) continue;

    const value = rule.deterministicValue;
    const field = rule.fieldName;

    // Apply to correct nested object
    if (field.startsWith("issuer_") || field === "issuer_name") {
      const key = field.replace("issuer_", "") as keyof typeof result.issuer;
      if (key in result.issuer) {
        (result.issuer as Record<string, unknown>)[key] = value;
        result.confidence.per_field[field] = 0.99;
      }
    } else if (field.startsWith("customer_")) {
      const key = field.replace("customer_", "") as keyof typeof result.customer;
      if (key in result.customer) {
        (result.customer as Record<string, unknown>)[key] = value;
        result.confidence.per_field[field] = 0.99;
      }
    }
  }

  return result;
}
```

- [ ] **Step 3: Write rule-learner tests**

Create `src/lib/services/extraction/__tests__/rule-learner.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectCorrections } from "../rules/rule-learner";

describe("detectCorrections", () => {
  it("detects a changed field", () => {
    const original = { issuer: { name: "OICE", tax_id: "0123456789012" } };
    const corrected = { issuerName: "L25-01-0015", issuerTaxId: "0123456789012" };

    const corrections = detectCorrections(
      original as Record<string, unknown>,
      { issuerName: "L25-01-0015" },
      "0123456789012"
    );

    expect(corrections).toHaveLength(1);
    expect(corrections[0].fieldName).toBe("issuer_name");
    expect(corrections[0].originalValue).toBe("OICE");
    expect(corrections[0].correctedValue).toBe("L25-01-0015");
  });

  it("returns empty array when no changes", () => {
    const corrections = detectCorrections(
      { issuer: { name: "Test" } } as Record<string, unknown>,
      {},
      "0123456789012"
    );
    expect(corrections).toHaveLength(0);
  });

  it("detects amount corrections", () => {
    const corrections = detectCorrections(
      { amounts: { vat_amount: 7 } } as Record<string, unknown>,
      { vatAmount: "122500" },
      "0123456789012"
    );
    expect(corrections).toHaveLength(1);
    expect(corrections[0].fieldName).toBe("vat_amount");
  });
});
```

- [ ] **Step 4: Implement rule-learner.ts**

Create `src/lib/services/extraction/rules/rule-learner.ts`:

```typescript
import { upsertExtractionRule } from "@/lib/db/queries/extraction-rules";

interface Correction {
  fieldName: string;
  originalValue: unknown;
  correctedValue: unknown;
  triggerKey: string;
  triggerValue: string;
}

// Map frontend field names → ocrRaw paths
const FIELD_MAP: Record<string, { section: string; field: string }> = {
  issuerName: { section: "issuer", field: "name" },
  issuerTaxId: { section: "issuer", field: "tax_id" },
  issuerBranch: { section: "issuer", field: "branch_id" },
  documentNumber: { section: "document", field: "invoice_number" },
  documentDate: { section: "document", field: "issue_date" },
  subtotal: { section: "amounts", field: "net_amount_ex_vat" },
  vatAmount: { section: "amounts", field: "vat_amount" },
  grandTotal: { section: "amounts", field: "total_amount" },
  discountAmount: { section: "amounts", field: "discount_amount" },
  customerTaxId: { section: "customer", field: "tax_id" },
  referencePo: { section: "document", field: "reference_po" },
};

export function detectCorrections(
  ocrRaw: Record<string, unknown>,
  editedFields: Record<string, unknown>,
  issuerTaxId: string | null
): Correction[] {
  const corrections: Correction[] = [];

  for (const [frontendKey, correctedValue] of Object.entries(editedFields)) {
    const mapping = FIELD_MAP[frontendKey];
    if (!mapping) continue;

    const section = (ocrRaw[mapping.section] || {}) as Record<string, unknown>;
    const originalValue = section[mapping.field];

    if (String(originalValue ?? "") !== String(correctedValue ?? "")) {
      corrections.push({
        fieldName: `${mapping.section === "issuer" ? "issuer_" : ""}${mapping.field}`,
        originalValue,
        correctedValue,
        triggerKey: issuerTaxId ? "issuer_tax_id" : "global",
        triggerValue: issuerTaxId || "all",
      });
    }
  }

  return corrections;
}

export async function learnFromCorrections(
  tenantId: string,
  ocrRaw: Record<string, unknown>,
  editedFields: Record<string, unknown>
): Promise<void> {
  const issuerTaxId = ((ocrRaw.issuer || {}) as Record<string, unknown>).tax_id as string | null;
  const corrections = detectCorrections(ocrRaw, editedFields, issuerTaxId);

  for (const correction of corrections) {
    const ruleText = `Field "${correction.fieldName}" was corrected from "${correction.originalValue}" to "${correction.correctedValue}"`;

    await upsertExtractionRule({
      tenantId,
      ruleType: correction.triggerKey === "issuer_tax_id" ? "issuer_hint" : "format_rule",
      triggerKey: correction.triggerKey,
      triggerValue: correction.triggerValue,
      fieldName: correction.fieldName,
      ruleText,
      deterministicValue: String(correction.correctedValue),
    });
  }
}
```

- [ ] **Step 5: Run rule-learner tests**

Run: `npx vitest run src/lib/services/extraction/__tests__/rule-learner.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/extraction/rules/ src/lib/services/extraction/__tests__/rule-learner.test.ts
git commit -m "feat: add rule loader, graduated rules, and rule learner with correction detection"
```

---

## Task 6: Pipeline Orchestrator

**Files:**
- Create: `src/lib/services/extraction/pipeline.ts`
- Create: `src/lib/services/extraction/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write pipeline integration test**

Create `src/lib/services/extraction/__tests__/pipeline.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock all tier modules
vi.mock("../tiers/tier1-haiku", () => ({
  extractTier1: vi.fn(),
}));
vi.mock("../tiers/tier2-sonnet", () => ({
  extractTier2: vi.fn(),
}));
vi.mock("../tiers/tier3-vision", () => ({
  extractTier3: vi.fn(),
}));
vi.mock("../rules/rule-loader", () => ({
  loadRules: vi.fn().mockResolvedValue({ promptRules: [], graduated: [] }),
}));

import { extractDocument } from "../pipeline";
import { extractTier1 } from "../tiers/tier1-haiku";
import { extractTier2 } from "../tiers/tier2-sonnet";
import type { TierResult } from "../types";

const highConfResult: TierResult = {
  tier: 1,
  data: {
    issuer: { name: "Test", tax_id: "0123456789012", branch_id: null, address: null, postal_code: null },
    customer: { name: null, tax_id: null, branch_id: null, address: null, postal_code: null },
    document: { document_type: "TAX_INVOICE", invoice_number: "INV-1", issue_date: "2024-01-01", due_date: null, credit_days: null, credit_due_date: null, reference_po: null },
    amounts: { net_amount_ex_vat: 100, vat_amount: 7, total_amount: 107, discount_amount: 0, currency: "THB", is_vat_included: false },
    line_items: [],
    confidence: { overall: 0.9, weighted: 0.85, per_field: { issuer_tax_id: 0.9, total_amount: 0.9, vat_amount: 0.9, invoice_number: 0.8, issue_date: 0.9 } },
  },
  validation: {
    lineItemCheck: { isValid: true, failures: [] },
    subtotalCheck: { isValid: true, expected: 100, got: 100 },
    vatCheck: { isValid: true, expected: 7, got: 7 },
    grandTotalCheck: { isValid: true, expected: 107, got: 107 },
    overallValid: true,
  },
  escalationReasons: [],
  costUsd: 0.004,
};

describe("extractDocument", () => {
  it("returns Tier 1 result when confidence is high", async () => {
    vi.mocked(extractTier1).mockResolvedValue(highConfResult);

    const result = await extractDocument("raw text here", "tenant-1");
    expect(result.tierUsed).toBe(1);
    expect(result.data.issuer.name).toBe("Test");
    expect(extractTier2).not.toHaveBeenCalled();
  });

  it("escalates to Tier 2 when confidence is low", async () => {
    const lowConf = {
      ...highConfResult,
      data: { ...highConfResult.data, confidence: { ...highConfResult.data.confidence, weighted: 0.5 } },
    };
    vi.mocked(extractTier1).mockResolvedValue(lowConf);
    vi.mocked(extractTier2).mockResolvedValue({ ...highConfResult, tier: 2, costUsd: 0.01 });

    const result = await extractDocument("raw text here", "tenant-1");
    expect(result.tierUsed).toBe(2);
    expect(extractTier2).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run pipeline test to verify it fails**

Run: `npx vitest run src/lib/services/extraction/__tests__/pipeline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pipeline.ts**

Create `src/lib/services/extraction/pipeline.ts`:

```typescript
import { extractTier1 } from "./tiers/tier1-haiku";
import { extractTier2 } from "./tiers/tier2-sonnet";
import { extractTier3 } from "./tiers/tier3-vision";
import { loadRules } from "./rules/rule-loader";
import { applyGraduatedRules } from "./rules/graduated-rules";
import { shouldEscalate } from "./validators/escalation-check";
import { validateAmounts } from "./validators/amount-validator";
import type { ExtractionResult, TierResult } from "./types";

const TIER_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Tier timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export async function extractDocument(
  rawText: string,
  tenantId: string,
  imageBase64?: string,
  mimeType?: string
): Promise<ExtractionResult> {
  const { promptRules, graduated } = await loadRules(tenantId, rawText);
  const allTierResults: TierResult[] = [];

  // --- Tier 1: Claude Haiku ---
  let bestResult: TierResult;
  try {
    bestResult = await withTimeout(extractTier1(rawText, promptRules), TIER_TIMEOUT_MS);
    bestResult.data = applyGraduatedRules(bestResult.data, graduated);
    bestResult.validation = validateAmounts(bestResult.data.amounts, bestResult.data.line_items);
    allTierResults.push(bestResult);
  } catch (error) {
    console.error("[Extraction] Tier 1 failed:", error);
    // Create empty result to allow escalation
    bestResult = createEmptyTierResult(1);
    allTierResults.push(bestResult);
  }

  // Check if we need Tier 2
  const t1Check = shouldEscalate(bestResult.data, bestResult.validation, true);
  if (t1Check.escalate) {
    try {
      const tier2Result = await withTimeout(
        extractTier2(rawText, promptRules, bestResult.data, t1Check.reasons),
        TIER_TIMEOUT_MS
      );
      tier2Result.data = applyGraduatedRules(tier2Result.data, graduated);
      tier2Result.validation = validateAmounts(tier2Result.data.amounts, tier2Result.data.line_items);
      allTierResults.push(tier2Result);
      bestResult = tier2Result;
    } catch (error) {
      console.error("[Extraction] Tier 2 failed:", error);
    }

    // Check if we need Tier 3
    const t2Check = shouldEscalate(bestResult.data, bestResult.validation, true);
    if (t2Check.escalate && imageBase64 && mimeType) {
      try {
        const tier1Data = allTierResults[0]?.data ?? bestResult.data;
        const tier3Result = await withTimeout(
          extractTier3(imageBase64, mimeType, rawText, promptRules, tier1Data, bestResult.data, t2Check.reasons),
          TIER_TIMEOUT_MS
        );
        tier3Result.data = applyGraduatedRules(tier3Result.data, graduated);
        tier3Result.validation = validateAmounts(tier3Result.data.amounts, tier3Result.data.line_items);
        allTierResults.push(tier3Result);
        bestResult = tier3Result;
      } catch (error) {
        console.error("[Extraction] Tier 3 failed:", error);
      }
    }
  }

  const totalCost = allTierResults.reduce((sum, r) => sum + r.costUsd, 0);
  const finalCheck = shouldEscalate(bestResult.data, bestResult.validation, true);

  return {
    data: bestResult.data,
    tierUsed: bestResult.tier,
    allTierResults,
    validation: bestResult.validation,
    escalationReasons: finalCheck.reasons,
    totalCostUsd: totalCost,
  };
}

function createEmptyTierResult(tier: 1 | 2 | 3): TierResult {
  return {
    tier,
    data: {
      issuer: { name: null, tax_id: null, branch_id: null, address: null, postal_code: null },
      customer: { name: null, tax_id: null, branch_id: null, address: null, postal_code: null },
      document: { document_type: null, invoice_number: null, issue_date: null, due_date: null, credit_days: null, credit_due_date: null, reference_po: null },
      amounts: { net_amount_ex_vat: null, vat_amount: null, total_amount: null, discount_amount: null, currency: "THB", is_vat_included: null },
      line_items: [],
      confidence: { overall: 0, weighted: 0, per_field: {} },
    },
    validation: {
      lineItemCheck: { isValid: true, failures: [] },
      subtotalCheck: { isValid: true, expected: null, got: null },
      vatCheck: { isValid: true, expected: null, got: null },
      grandTotalCheck: { isValid: true, expected: null, got: null },
      overallValid: true,
    },
    escalationReasons: [],
    costUsd: 0,
  };
}
```

- [ ] **Step 4: Run pipeline tests**

Run: `npx vitest run src/lib/services/extraction/__tests__/pipeline.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/extraction/pipeline.ts src/lib/services/extraction/__tests__/pipeline.test.ts
git commit -m "feat: add extraction pipeline orchestrator with three-tier escalation"
```

---

## Task 7: Update Inngest Process-Document Function

**Files:**
- Modify: `src/lib/inngest/functions/process-document.ts`
- Modify: `src/lib/services/ocr.ts`

- [ ] **Step 1: Read current process-document.ts for exact code**

Read `src/lib/inngest/functions/process-document.ts` to get exact current step structure before modifying.

- [ ] **Step 2: Extract Google Vision raw text function from ocr.ts**

In `src/lib/services/ocr.ts`, the Google Vision call currently lives inside `extractBillDataGoogleVision()`. Keep only the raw text extraction, remove regex parsing. Rename and export as:

```typescript
export async function extractRawTextGoogleVision(
  imageBuffer: Buffer,
  mimeType = "image/jpeg"
): Promise<{ rawText: string; provider: string }> {
  const base64Image = imageBuffer.toString("base64");
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["th", "en"] },
        }],
      }),
    }
  );

  const data = await response.json();
  const rawText = data.responses?.[0]?.fullTextAnnotation?.text || "";
  return { rawText, provider: "google_vision" };
}
```

- [ ] **Step 3: Update process-document.ts to use new pipeline**

Replace the OCR extraction step and update persistence. Key changes:

```typescript
import { extractRawTextGoogleVision } from "@/lib/services/ocr";
import { extractDocument } from "@/lib/services/extraction/pipeline";
import { classifyTransaction } from "@/lib/services/classification";

// Step 1: "ocr-raw-text" — Google Vision only
const { rawText, provider } = await step.run("ocr-raw-text", async () => {
  return extractRawTextGoogleVision(imageBuffer, mimeType);
});

// Step 2: "extract-structured" — NEW: three-tier AI pipeline
const extraction = await step.run("extract-structured", async () => {
  const imageBase64 = imageBuffer.toString("base64");
  return extractDocument(rawText, doc.tenantId, imageBase64, mimeType);
});

// Step 3: "classify" — unchanged, uses extraction.data
const classification = await step.run("classify", async () => {
  return classifyTransaction({
    tenantTaxId: tenant?.taxId,
    issuerTaxId: extraction.data.issuer.tax_id,
    extractedData: extraction.data as unknown as Record<string, any>,
    billType: extraction.data.document.document_type,
  });
});

// Step 4: "tax-gl-mapping" — unchanged

// Step 5: "persist-results" — updated to save new fields
await step.run("persist-results", async () => {
  const nextStatus = determineStatus(extraction, classification);

  await db.update(documents).set({
    issuerTaxId: extraction.data.issuer.tax_id,
    issuerName: extraction.data.issuer.name,
    issuerBranch: extraction.data.issuer.branch_id,
    customerTaxId: extraction.data.customer.tax_id,
    documentNumber: extraction.data.document.invoice_number,
    documentDate: extraction.data.document.issue_date,
    subtotal: extraction.data.amounts.net_amount_ex_vat?.toString(),
    vatAmount: extraction.data.amounts.vat_amount?.toString(),
    grandTotal: extraction.data.amounts.total_amount?.toString(),
    discountAmount: extraction.data.amounts.discount_amount?.toString(),
    referencePo: extraction.data.document.reference_po,
    creditDueDate: extraction.data.document.credit_due_date,
    dueDate: extraction.data.document.due_date,
    confidenceScore: extraction.data.confidence.weighted.toString(),
    direction: classification.direction,
    docType: classification.docType,
    journalType: classification.journalType,
    status: nextStatus,
    extractionStatus: "completed",
    ocrRaw: {
      ...extraction.data,
      meta: { provider, mime_type: mimeType },
      ocr_version: `pipeline-v1-tier${extraction.tierUsed}`,
      processing: {
        ocr_tier_used: extraction.tierUsed,
        early_terminated: false,
        low_quality: extraction.data.confidence.weighted < 0.5,
        needs_rotation_review: false,
      },
      validation: {
        amount_equation: {
          isValid: extraction.validation.overallValid,
          tolerance: 1.0,
        },
        raw_text_excerpt: rawText.substring(0, 500),
      },
      extraction_debug: {
        tier_used: extraction.tierUsed,
        all_tier_results: extraction.allTierResults,
        escalation_reasons: extraction.escalationReasons,
        cost_usd: extraction.totalCostUsd,
      },
    },
    whtAmount: taxGl.wht?.amount?.toString(),
    whtIncomeType: taxGl.wht?.incomeType,
    whtRate: taxGl.wht?.rate?.toString(),
    updatedAt: new Date(),
  }).where(eq(documents.id, doc.id));
});
```

- [ ] **Step 4: Add determineStatus helper**

```typescript
function determineStatus(
  extraction: ExtractionResult,
  classification: ReturnType<typeof classifyTransaction>
): string {
  if (extraction.data.confidence.weighted < 0.5) return "QUERY";
  if (classification.pendingMatch) return "ACTION_REQUIRED";
  if (!extraction.validation.overallValid) return "ACTION_REQUIRED";
  if (extraction.data.confidence.weighted < 0.7) return "ACTION_REQUIRED";
  return "PENDING_APPROVAL";
}
```

- [ ] **Step 5: Handle extraction failures in process-document**

Wrap the extraction step with error handling:

```typescript
const extraction = await step.run("extract-structured", async () => {
  try {
    const imageBase64 = imageBuffer.toString("base64");
    const result = await extractDocument(rawText, doc.tenantId, imageBase64, mimeType);
    return { success: true, result };
  } catch (error) {
    console.error("[Process Document] Extraction pipeline failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
});

if (!extraction.success) {
  await db.update(documents).set({
    status: "QUERY",
    extractionStatus: "failed",
    extractionFailureReason: extraction.error,
    ocrRaw: { raw_text: rawText, meta: { provider } },
    updatedAt: new Date(),
  }).where(eq(documents.id, doc.id));
  return;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/inngest/functions/process-document.ts src/lib/services/ocr.ts
git commit -m "feat: integrate three-tier extraction pipeline into document processing flow"
```

---

## Task 8: Update Document PATCH API — Trigger Rule Learning

**Files:**
- Modify: `src/app/api/documents/[id]/route.ts`

- [ ] **Step 1: Read current PATCH handler**

Read `src/app/api/documents/[id]/route.ts` to get exact current code.

- [ ] **Step 2: Add rule learning trigger to PATCH handler**

After the existing update logic, add:

```typescript
import { learnFromCorrections } from "@/lib/services/extraction/rules/rule-learner";

// Inside PATCH handler, after successful update:
// Trigger rule learning in background (don't block response)
if (body.ocrRaw && Object.keys(editedFields).length > 0) {
  learnFromCorrections(ctx.tenantId, existingDoc.ocrRaw as Record<string, unknown>, editedFields)
    .catch((err) => console.error("[Rule Learning] Failed:", err));
}
```

Where `editedFields` is derived from the PATCH body (only fields that were actually sent):

```typescript
const editedFields: Record<string, unknown> = {};
if (body.issuerName !== undefined) editedFields.issuerName = body.issuerName;
if (body.issuerTaxId !== undefined) editedFields.issuerTaxId = body.issuerTaxId;
if (body.issuerBranch !== undefined) editedFields.issuerBranch = body.issuerBranch;
if (body.documentNumber !== undefined) editedFields.documentNumber = body.documentNumber;
if (body.documentDate !== undefined) editedFields.documentDate = body.documentDate;
if (body.subtotal !== undefined) editedFields.subtotal = body.subtotal;
if (body.vatAmount !== undefined) editedFields.vatAmount = body.vatAmount;
if (body.grandTotal !== undefined) editedFields.grandTotal = body.grandTotal;
if (body.customerTaxId !== undefined) editedFields.customerTaxId = body.customerTaxId;
if (body.discountAmount !== undefined) editedFields.discountAmount = body.discountAmount;
if (body.referencePo !== undefined) editedFields.referencePo = body.referencePo;
```

- [ ] **Step 3: Add new columns to PATCH body type and update query**

Add to the PatchBody type:

```typescript
customerTaxId?: string | null;
discountAmount?: number | null;
referencePo?: string | null;
creditDueDate?: string | null;
```

Add to the update query:

```typescript
...(body.customerTaxId !== undefined && { customerTaxId: body.customerTaxId }),
...(body.discountAmount !== undefined && { discountAmount: body.discountAmount?.toString() }),
...(body.referencePo !== undefined && { referencePo: body.referencePo }),
...(body.creditDueDate !== undefined && { creditDueDate: body.creditDueDate }),
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/documents/[id]/route.ts
git commit -m "feat: trigger rule learning on document corrections and support new extraction fields"
```

---

## Task 9: Update Extractions Page UI

**Files:**
- Modify: `src/app/(app)/extractions/page.tsx`

- [ ] **Step 1: Read current extractions page**

Read `src/app/(app)/extractions/page.tsx` to get exact current JSX structure.

- [ ] **Step 2: Add new fields to Document Information section**

After the existing Credit Days field, add:

```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="text-sm font-medium text-secondary">Reference PO</label>
    {canEdit ? (
      <Input
        value={editValues.referencePo ?? doc.referencePo ?? ocrRaw?.document?.reference_po ?? ""}
        onChange={(e) => setEditValues((prev) => ({ ...prev, referencePo: e.target.value }))}
        placeholder="PO number"
      />
    ) : (
      <p className="text-sm mt-1">{doc.referencePo ?? ocrRaw?.document?.reference_po ?? "—"}</p>
    )}
  </div>
  <div>
    <label className="text-sm font-medium text-secondary">Credit Due Date</label>
    {canEdit ? (
      <Input
        type="date"
        value={editValues.creditDueDate ?? doc.creditDueDate ?? ocrRaw?.document?.credit_due_date ?? ""}
        onChange={(e) => setEditValues((prev) => ({ ...prev, creditDueDate: e.target.value }))}
      />
    ) : (
      <p className="text-sm mt-1">{doc.creditDueDate ?? ocrRaw?.document?.credit_due_date ?? "—"}</p>
    )}
  </div>
</div>
```

- [ ] **Step 3: Add Tax ID to Customer Information section**

In the Customer section, add after the Name field:

```tsx
<div>
  <label className="text-sm font-medium text-secondary">Tax ID</label>
  {canEdit ? (
    <Input
      value={editValues.customerTaxId ?? doc.customerTaxId ?? ocrRaw?.customer?.tax_id ?? ""}
      onChange={(e) => setEditValues((prev) => ({ ...prev, customerTaxId: e.target.value }))}
      placeholder="13-digit tax ID"
    />
  ) : (
    <p className="text-sm mt-1">{doc.customerTaxId ?? ocrRaw?.customer?.tax_id ?? "—"}</p>
  )}
</div>
```

- [ ] **Step 4: Add Discount field to Amounts section**

Between Subtotal and VAT Amount:

```tsx
<div>
  <label className="text-sm font-medium text-secondary">Discount</label>
  {canEdit ? (
    <Input
      type="number"
      step="0.01"
      className="tabular-nums"
      value={editValues.discountAmount ?? doc.discountAmount ?? ocrRaw?.amounts?.discount_amount ?? "0"}
      onChange={(e) => setEditValues((prev) => ({ ...prev, discountAmount: e.target.value }))}
    />
  ) : (
    <p className="text-sm mt-1 tabular-nums">{formatAmount(doc.discountAmount ?? ocrRaw?.amounts?.discount_amount ?? 0)}</p>
  )}
</div>
```

- [ ] **Step 5: Add Discount column to Line Items table**

Update the line items table header and rows. Add between Unit Price and Total:

Header:
```tsx
<th className="text-right px-3 py-2">Discount</th>
```

Row:
```tsx
<td className="text-right px-3 py-2 tabular-nums">
  {item.discount != null ? formatAmount(item.discount) : "—"}
</td>
```

- [ ] **Step 6: Add validation indicators to Amounts section**

After the amount fields, add validation display (only shown when failures exist):

```tsx
{ocrRaw?.extraction_debug && !validation?.overallValid && (
  <div className="mt-3 space-y-1 text-sm">
    <ValidationIndicator
      label="Line items check"
      isValid={validation.lineItemCheck.isValid}
      detail={validation.lineItemCheck.isValid ? undefined : `${validation.lineItemCheck.failures.length} line(s) with math errors`}
    />
    <ValidationIndicator
      label="Subtotal check"
      isValid={validation.subtotalCheck.isValid}
      detail={validation.subtotalCheck.isValid ? undefined : `Expected ${formatAmount(validation.subtotalCheck.expected)} got ${formatAmount(validation.subtotalCheck.got)}`}
    />
    <ValidationIndicator
      label="VAT check"
      isValid={validation.vatCheck.isValid}
      detail={validation.vatCheck.isValid ? undefined : `Expected ${formatAmount(validation.vatCheck.expected)} got ${formatAmount(validation.vatCheck.got)}`}
    />
    <ValidationIndicator
      label="Grand total check"
      isValid={validation.grandTotalCheck.isValid}
      detail={validation.grandTotalCheck.isValid ? undefined : `Expected ${formatAmount(validation.grandTotalCheck.expected)} got ${formatAmount(validation.grandTotalCheck.got)}`}
    />
  </div>
)}
```

With helper component (inline in the same file):

```tsx
function ValidationIndicator({ label, isValid, detail }: { label: string; isValid: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={isValid ? "text-success" : "text-destructive"}>
        {isValid ? "✓" : "✗"}
      </span>
      <span>{label}</span>
      {detail && <span className="text-secondary text-xs">({detail})</span>}
    </div>
  );
}
```

- [ ] **Step 7: Add extraction failure banner**

At the top of the right panel, before the sections:

```tsx
{doc.extractionStatus === "failed" || doc.extractionStatus === "partial" ? (
  <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 mb-4">
    <div className="flex items-center gap-2 mb-2">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <span className="font-medium">Extraction incomplete</span>
    </div>
    <p className="text-sm text-secondary mb-3">
      {doc.extractionFailureReason ?? "Some fields could not be extracted automatically."}
    </p>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={retryExtraction}>
        Retry Extraction
      </Button>
      <Button variant="outline" size="sm" onClick={enterManually}>
        Enter Manually
      </Button>
    </div>
  </div>
) : null}
```

- [ ] **Step 8: Add retry and manual entry handlers**

```tsx
async function retryExtraction() {
  const res = await fetch(`/api/documents/${doc.id}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });
  if (res.ok) {
    toast.success("Re-extraction started");
    // Refetch document after delay
    setTimeout(() => refetch(), 3000);
  } else {
    toast.error("Failed to start re-extraction");
  }
}

function enterManually() {
  // Set extraction status to manual via PATCH
  fetch(`/api/documents/${doc.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, extractionStatus: "manual" }),
  });
}
```

- [ ] **Step 9: Remove Raw OCR JSON section**

Find and remove the section that renders raw OCR JSON (look for "Raw OCR" or "ocrRaw" display). Delete the entire `<details>` or `<Section>` block that shows the JSON.

- [ ] **Step 10: Update saveDraft to include new fields**

In the `saveDraft()` function, add new fields to the PATCH body:

```typescript
...(editValues.customerTaxId !== undefined && { customerTaxId: editValues.customerTaxId }),
...(editValues.discountAmount !== undefined && { discountAmount: Number(editValues.discountAmount) }),
...(editValues.referencePo !== undefined && { referencePo: editValues.referencePo }),
...(editValues.creditDueDate !== undefined && { creditDueDate: editValues.creditDueDate }),
```

- [ ] **Step 11: Commit**

```bash
git add src/app/(app)/extractions/page.tsx
git commit -m "feat: add new extraction fields, validation indicators, retry/manual buttons to extraction UI"
```

---

## Task 10: Retry Extraction API Route

**Files:**
- Create: `src/app/api/documents/[id]/retry/route.ts`

- [ ] **Step 1: Create retry route**

Create `src/app/api/documents/[id]/retry/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, unauthorized, forbidden, ensureTenantScope } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  if (!ensureTenantScope(ctx.tenantId, body.tenantId)) {
    return forbidden("Cross-tenant access denied");
  }

  // Verify document exists and belongs to tenant
  const [doc] = await db
    .select({ id: documents.id, tenantId: documents.tenantId, status: documents.status })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc || doc.tenantId !== ctx.tenantId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Update status to processing
  await db
    .update(documents)
    .set({
      extractionStatus: "processing",
      extractionFailureReason: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));

  // Trigger re-extraction via Inngest
  await inngest.send({
    name: "document/uploaded",
    data: { documentId: id, tenantId: ctx.tenantId, retry: true },
  });

  return NextResponse.json({ success: true, message: "Re-extraction started" });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/documents/[id]/retry/route.ts
git commit -m "feat: add retry extraction API endpoint"
```

---

## Task 11: Feature Flag & Migration Cleanup

**Files:**
- Modify: `src/lib/inngest/functions/process-document.ts`

- [ ] **Step 1: Add feature flag check**

At the top of the process-document function, add:

```typescript
const USE_NEW_PIPELINE = process.env.USE_NEW_EXTRACTION_PIPELINE !== "false";
```

Wrap the new pipeline in a conditional, falling back to old code:

```typescript
if (USE_NEW_PIPELINE) {
  // New three-tier pipeline (Task 7 code)
} else {
  // Old extractBillData() call
}
```

- [ ] **Step 2: Apply the database migration**

Run:
```bash
npx drizzle-kit push
```

Expected: New columns and table created in the database.

- [ ] **Step 3: Verify build compiles**

Run:
```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/inngest/functions/process-document.ts
git commit -m "feat: add feature flag for new extraction pipeline with old code fallback"
```

---

## Task 12: Run Full Test Suite & Final Verification

- [ ] **Step 1: Run all extraction tests**

Run:
```bash
npx vitest run src/lib/services/extraction/
```

Expected: All tests PASS.

- [ ] **Step 2: Run full project build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Verify feature flag works**

Set `USE_NEW_EXTRACTION_PIPELINE=false` in `.env.local` and verify old pipeline still works. Then set back to `true`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 6A extraction accuracy overhaul complete"
```
