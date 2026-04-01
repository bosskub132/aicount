import { getProvider } from "@/lib/services/ai/factory";
import { calculateCost } from "@/lib/services/ai/models";
import { buildTier2Prompt } from "../prompts/base-extraction";
import { normalizeClaudeResponse } from "../parsers/response-normalizer";
import { validateAmounts } from "../validators/amount-validator";
import type { TierResult, LearnedRule, ExtractedData } from "../types";

const MODEL = "claude-sonnet-4-6-20250514";

export async function extractTier2(
  rawText: string,
  rules: LearnedRule[],
  tier1Data: ExtractedData,
  tier1Reasons: string[]
): Promise<TierResult> {
  const prompt = buildTier2Prompt(rawText, rules, tier1Data, tier1Reasons);

  const provider = getProvider();
  const response = await provider.chat({
    model: MODEL,
    maxTokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const data = normalizeClaudeResponse(parsed);
  const validation = validateAmounts(data.amounts, data.line_items);

  const { inputTokens, outputTokens } = response.usage;
  const costUsd = calculateCost(MODEL, inputTokens, outputTokens);

  return {
    tier: 2,
    data,
    validation,
    escalationReasons: tier1Reasons,
    costUsd,
    inputTokens,
    outputTokens,
    model: MODEL,
  };
}
