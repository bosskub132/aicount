import crypto from "crypto";
import { upsertPattern } from "@/lib/db/queries/cross-tenant-patterns";
import type { PatternOutcome } from "./types";

export function hashTenantId(tenantId: string): string {
  return crypto.createHash("sha256").update(tenantId).digest("hex").slice(0, 8);
}

export async function processCrossTenantOutcome(
  outcome: PatternOutcome
): Promise<void> {
  const isAccepted = outcome.status === "accepted";
  // "edited" counts as dismissed for pattern confidence purposes
  const isRelevant =
    outcome.status === "accepted" ||
    outcome.status === "dismissed" ||
    outcome.status === "edited";
  if (!isRelevant) return;

  const tenantHash = hashTenantId(outcome.tenantId);

  await upsertPattern({
    patternType: outcome.patternType,
    triggerKey: outcome.triggerKey,
    fieldName: outcome.fieldName,
    suggestedValue: outcome.suggestedValue,
    isAccepted,
    tenantHash,
  });
}
