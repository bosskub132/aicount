import { getProvider } from "@/lib/services/ai/factory";
import { calculateCost } from "@/lib/services/ai/models";
import { buildTier3Prompt } from "../prompts/base-extraction";
import { normalizeClaudeResponse } from "../parsers/response-normalizer";
import { validateAmounts } from "../validators/amount-validator";
import type { TierResult, LearnedRule, ExtractedData } from "../types";

const MODEL = "claude-sonnet-4-6-20250514";

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
    tier1Data,
    tier2Data,
    escalationReasons
  );

  const provider = getProvider();
  const response = await provider.chatWithVision({
    model: MODEL,
    maxTokens: 1500,
    messages: [{ role: "user", content: textPrompt }],
    images: [
      {
        type: "base64",
        data: imageBase64,
        mediaType: mimeType,
      },
    ],
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
    tier: 3,
    data,
    validation,
    escalationReasons,
    costUsd,
    inputTokens,
    outputTokens,
    model: MODEL,
  };
}
