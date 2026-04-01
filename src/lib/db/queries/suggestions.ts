import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiSuggestions } from "@/lib/db/schema";
import type {
  Suggestion,
  SuggestionResult,
  SuggestionOutcome,
} from "@/lib/services/suggestions/types";

export async function insertSuggestions(
  tenantId: string,
  documentId: string,
  results: SuggestionResult[]
): Promise<void> {
  if (results.length === 0) return;

  await db.insert(aiSuggestions).values(
    results.map((r) => ({
      tenantId,
      documentId,
      feature: r.feature,
      fieldName: r.fieldName,
      suggestedValue: r.suggestedValue,
      confidence: String(r.confidence),
      source: r.source,
      sourceContext: r.sourceContext ?? null,
    }))
  );
}

export async function getPendingSuggestions(
  documentId: string
): Promise<Suggestion[]> {
  const rows = await db
    .select()
    .from(aiSuggestions)
    .where(
      and(
        eq(aiSuggestions.documentId, documentId),
        eq(aiSuggestions.status, "pending")
      )
    );

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    documentId: r.documentId,
    feature: r.feature as Suggestion["feature"],
    fieldName: r.fieldName,
    suggestedValue: r.suggestedValue,
    confidence: Number(r.confidence),
    source: r.source as Suggestion["source"],
    sourceContext: r.sourceContext as Record<string, unknown> | null,
    status: r.status as Suggestion["status"],
    finalValue: r.finalValue,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  }));
}

export async function hasAnySuggestions(documentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: aiSuggestions.id })
    .from(aiSuggestions)
    .where(eq(aiSuggestions.documentId, documentId))
    .limit(1);
  return !!row;
}

export async function resolveSuggestions(
  outcomes: SuggestionOutcome[]
): Promise<void> {
  const now = new Date();
  for (const outcome of outcomes) {
    await db
      .update(aiSuggestions)
      .set({
        status: outcome.status,
        finalValue: outcome.finalValue ?? null,
        resolvedAt: now,
      })
      .where(eq(aiSuggestions.id, outcome.id));
  }
}
