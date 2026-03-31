import type { LearnedRule } from "../types";
import { loadRulesForExtraction } from "@/lib/db/queries/extraction-rules";

export async function loadRules(
  tenantId: string,
  rawText: string
): Promise<{ promptRules: LearnedRule[]; graduated: LearnedRule[] }> {
  // Extract potential issuer tax ID from raw text (13-digit Thai tax ID)
  const taxIdMatch = rawText.match(/\d{13}/);
  const issuerTaxId = taxIdMatch ? taxIdMatch[0] : "";

  if (!issuerTaxId) {
    return { promptRules: [], graduated: [] };
  }

  const dbResult = await loadRulesForExtraction(tenantId, issuerTaxId);

  const mapToLearnedRule = (row: (typeof dbResult.graduated)[number]): LearnedRule => ({
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
  });

  return {
    promptRules: dbResult.promptRules.map(mapToLearnedRule),
    graduated: dbResult.graduated.map(mapToLearnedRule),
  };
}
