import { db } from "@/lib/db";
import { aiUsageLogs } from "@/lib/db/schema";

interface LogUsageParams {
  tenantId: string;
  documentId: string;
  provider: "anthropic" | "google";
  model: string;
  feature?: string;
  tier?: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  metadata?: Record<string, unknown> | null;
}

export async function logAiUsage(params: LogUsageParams): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      tenantId: params.tenantId,
      documentId: params.documentId,
      provider: params.provider,
      model: params.model,
      feature: params.feature ?? "extraction",
      tier: params.tier ?? null,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd: params.costUsd.toFixed(6),
      metadata: params.metadata ?? null,
    });
  } catch (error: unknown) {
    // Non-blocking: log error but don't fail the extraction
    // eslint-disable-next-line no-console
    console.error(
      "[usage-logger] Failed to log AI usage:",
      error instanceof Error ? error.message : error
    );
  }
}
