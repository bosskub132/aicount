import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiSuggestions, aiExtractionRules } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import type { SuggestionOutcome } from "./types";
import type { PatternType } from "@/lib/services/learning/types";

const CROSS_TENANT_FEATURES: string[] = [
  "coa_mapping",
  "wht_rate",
  "smart_default",
];

export async function feedLearner(
  outcomes: SuggestionOutcome[]
): Promise<void> {
  const patternEvents: Array<{
    name: "suggestion/outcome.processed";
    data: {
      patternType: PatternType;
      triggerKey: string;
      fieldName: string;
      suggestedValue: string;
      status: string;
      tenantId: string;
    };
  }> = [];

  for (const outcome of outcomes) {
    const [suggestion] = await db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, outcome.id))
      .limit(1);

    if (!suggestion) continue;

    // Existing: degrade matching rules for dismissed/edited
    if (
      outcome.status === "dismissed" ||
      (outcome.status === "edited" && outcome.finalValue)
    ) {
      await degradeMatchingRules(
        suggestion.tenantId,
        suggestion.fieldName,
        suggestion.suggestedValue
      );
    }

    // Cross-tenant learning: emit event for pattern aggregation
    if (CROSS_TENANT_FEATURES.includes(suggestion.feature)) {
      const sourceContext = suggestion.sourceContext as Record<
        string,
        unknown
      > | null;
      const triggerKey = (sourceContext?.triggerKey as string) ?? "";

      if (triggerKey) {
        patternEvents.push({
          name: "suggestion/outcome.processed",
          data: {
            patternType: suggestion.feature as PatternType,
            triggerKey,
            fieldName: suggestion.fieldName,
            suggestedValue: suggestion.suggestedValue,
            status: outcome.status,
            tenantId: suggestion.tenantId,
          },
        });
      }
    }
  }

  // Batch send cross-tenant pattern events
  if (patternEvents.length > 0) {
    await inngest.send(patternEvents);
  }
}

async function degradeMatchingRules(
  tenantId: string,
  fieldName: string,
  suggestedValue: string
): Promise<void> {
  const rules = await db
    .select()
    .from(aiExtractionRules)
    .where(
      and(
        eq(aiExtractionRules.tenantId, tenantId),
        eq(aiExtractionRules.fieldName, fieldName)
      )
    );

  for (const rule of rules) {
    if (rule.deterministicValue === suggestedValue) {
      const newConfidence = Math.max(0.1, Number(rule.confidence) - 0.2);
      const isGraduated = newConfidence >= 0.5 ? rule.isGraduated : false;

      await db
        .update(aiExtractionRules)
        .set({
          confidence: String(newConfidence),
          isGraduated,
          updatedAt: new Date(),
        })
        .where(eq(aiExtractionRules.id, rule.id));
    }
  }
}
