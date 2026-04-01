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
  const costUsd = (inputTokens * 0.8 + outputTokens * 4) / 1_000_000;

  return {
    tier: 1,
    data,
    validation,
    escalationReasons: [],
    costUsd,
    inputTokens,
    outputTokens,
    model: "claude-haiku-4-5-20251001",
  };
}
