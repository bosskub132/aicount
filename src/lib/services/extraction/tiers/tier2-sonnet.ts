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
  const prompt = buildTier2Prompt(rawText, rules, tier1Data, tier1Reasons);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

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
    inputTokens,
    outputTokens,
    model: "claude-sonnet-4-6-20250514",
  };
}
