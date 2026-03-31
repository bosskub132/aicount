import { and, eq, or, isNull, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiExtractionRules } from "@/lib/db/schema";

interface LoadedRules {
  graduated: Array<typeof aiExtractionRules.$inferSelect>;
  promptRules: Array<typeof aiExtractionRules.$inferSelect>;
}

export async function loadRulesForExtraction(
  tenantId: string,
  issuerTaxId: string
): Promise<LoadedRules> {
  const rules = await db
    .select()
    .from(aiExtractionRules)
    .where(
      and(
        or(
          eq(aiExtractionRules.tenantId, tenantId),
          isNull(aiExtractionRules.tenantId)
        ),
        eq(aiExtractionRules.triggerKey, "issuer_tax_id"),
        eq(aiExtractionRules.triggerValue, issuerTaxId)
      )
    )
    .orderBy(desc(aiExtractionRules.confidence))
    .limit(20);

  const graduated: Array<typeof aiExtractionRules.$inferSelect> = [];
  const promptRules: Array<typeof aiExtractionRules.$inferSelect> = [];

  for (const rule of rules) {
    if (rule.isGraduated) {
      graduated.push(rule);
    } else {
      promptRules.push(rule);
    }
  }

  return { graduated, promptRules };
}

interface UpsertExtractionRuleParams {
  tenantId: string;
  ruleType: string;
  triggerKey: string;
  triggerValue: string;
  fieldName: string;
  ruleText: string;
  deterministicValue?: string | null;
}

export async function upsertExtractionRule(
  params: UpsertExtractionRuleParams
): Promise<typeof aiExtractionRules.$inferSelect> {
  // Try to find an existing rule with the same composite key
  const [existing] = await db
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

  if (existing) {
    // Bump confidence: min(0.99, conf + (1 - conf) * 0.15)
    const currentConf = Number(existing.confidence);
    const newConf = Math.min(0.99, currentConf + (1 - currentConf) * 0.15);
    const newSampleCount = existing.sampleCount + 1;
    const shouldGraduate = newConf > 0.95 && newSampleCount >= 10;

    const [updated] = await db
      .update(aiExtractionRules)
      .set({
        sampleCount: newSampleCount,
        confidence: newConf.toFixed(2),
        isGraduated: shouldGraduate || existing.isGraduated,
        ruleText: params.ruleText,
        deterministicValue: params.deterministicValue ?? existing.deterministicValue,
        updatedAt: sql`now()`,
      })
      .where(eq(aiExtractionRules.id, existing.id))
      .returning();

    return updated;
  }

  // Create new rule
  const [created] = await db
    .insert(aiExtractionRules)
    .values({
      tenantId: params.tenantId,
      ruleType: params.ruleType,
      triggerKey: params.triggerKey,
      triggerValue: params.triggerValue,
      fieldName: params.fieldName,
      ruleText: params.ruleText,
      deterministicValue: params.deterministicValue ?? null,
    })
    .returning();

  return created;
}

export async function degradeRule(ruleId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(aiExtractionRules)
    .where(eq(aiExtractionRules.id, ruleId))
    .limit(1);

  if (!existing) return;

  const currentConf = Number(existing.confidence);
  const newConf = currentConf - 0.2;

  // Delete if below threshold
  if (newConf < 0.2) {
    await db
      .delete(aiExtractionRules)
      .where(eq(aiExtractionRules.id, ruleId));
    return;
  }

  // Un-graduate if below 0.50
  const shouldUngraduate = newConf < 0.5;

  await db
    .update(aiExtractionRules)
    .set({
      confidence: newConf.toFixed(2),
      isGraduated: shouldUngraduate ? false : existing.isGraduated,
      updatedAt: sql`now()`,
    })
    .where(eq(aiExtractionRules.id, ruleId));
}
