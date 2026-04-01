import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiSuggestions, aiExtractionRules } from "@/lib/db/schema";
import type { SuggestionOutcome } from "./types";

export async function feedLearner(
  outcomes: SuggestionOutcome[]
): Promise<void> {
  for (const outcome of outcomes) {
    const [suggestion] = await db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, outcome.id))
      .limit(1);

    if (!suggestion) continue;

    if (outcome.status === "dismissed") {
      await degradeMatchingRules(
        suggestion.tenantId,
        suggestion.fieldName,
        suggestion.suggestedValue
      );
    }

    if (outcome.status === "edited" && outcome.finalValue) {
      await degradeMatchingRules(
        suggestion.tenantId,
        suggestion.fieldName,
        suggestion.suggestedValue
      );
    }
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
