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
    tier1Data,
    tier2Data,
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
              media_type: mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/webp"
                | "image/gif",
              data: imageBase64,
            },
          },
          { type: "text", text: textPrompt },
        ],
      },
    ],
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
    tier: 3,
    data,
    validation,
    escalationReasons,
    costUsd,
  };
}
