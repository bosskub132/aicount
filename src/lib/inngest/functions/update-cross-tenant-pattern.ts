import { inngest } from "@/lib/inngest/client";
import { processCrossTenantOutcome } from "@/lib/services/learning/cross-tenant-engine";
import type { PatternOutcome } from "@/lib/services/learning/types";

export const updateCrossTenantPattern = inngest.createFunction(
  { id: "update-cross-tenant-pattern", retries: 3 },
  { event: "suggestion/outcome.processed" },
  async ({ event }) => {
    const outcome = event.data as PatternOutcome;

    if (!outcome.triggerKey || !outcome.fieldName || !outcome.suggestedValue) {
      return { skipped: true, reason: "missing required fields" };
    }

    await processCrossTenantOutcome(outcome);

    return {
      patternType: outcome.patternType,
      triggerKey: outcome.triggerKey,
      status: outcome.status,
    };
  }
);
