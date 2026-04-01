import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { queryCrossTenantPattern } from "@/lib/db/queries/cross-tenant-patterns";
import { normalizeTriggerKey } from "@/lib/services/learning/trigger-keys";
import type { SuggestionResult } from "../types";

const MIN_CONFIDENCE = 0.6;

/**
 * Gets the most frequent value for a given column among past documents for
 * the same vendor. Returns the value and confidence (frequency/total).
 */
async function getMostFrequentValue(
  tenantId: string,
  issuerTaxId: string,
  column: typeof documents.docType | typeof documents.direction
): Promise<{ value: string; confidence: number } | null> {
  const rows = await db
    .select({
      value: column,
      count: sql<string>`count(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.issuerTaxId, issuerTaxId),
        isNotNull(column)
      )
    )
    .groupBy(column)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  if (rows.length === 0 || rows[0].value == null) return null;

  const totalRows = await db
    .select({ total: sql<string>`count(*)` })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.issuerTaxId, issuerTaxId),
        isNotNull(column)
      )
    );

  const total = Number(totalRows[0]?.total ?? 1);
  const freq = Number(rows[0].count);
  const confidence = Math.min(freq / total, 0.95);

  if (confidence < MIN_CONFIDENCE) return null;

  return { value: String(rows[0].value), confidence };
}

/**
 * Suggests the most likely docType and direction for a document based on
 * historical patterns from the same vendor. Only suggests if confidence >= 0.6.
 */
export async function fromHistory(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const [currentDoc] = await db
    .select({ issuerTaxId: documents.issuerTaxId })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!currentDoc?.issuerTaxId) return [];

  const [docTypeResult, directionResult] = await Promise.all([
    getMostFrequentValue(tenantId, currentDoc.issuerTaxId, documents.docType),
    getMostFrequentValue(tenantId, currentDoc.issuerTaxId, documents.direction),
  ]);

  const results: SuggestionResult[] = [];

  if (docTypeResult) {
    const triggerKey = normalizeTriggerKey("smart_default", "unknown", "docType");
    results.push({
      feature: "smart_default" as const,
      fieldName: "docType",
      suggestedValue: docTypeResult.value,
      confidence: docTypeResult.confidence,
      source: "frequency" as const,
      sourceContext: {
        issuerTaxId: currentDoc.issuerTaxId,
        triggerKey,
      },
    });
  }

  if (directionResult) {
    const triggerKey = normalizeTriggerKey("smart_default", "unknown", "direction");
    results.push({
      feature: "smart_default" as const,
      fieldName: "direction",
      suggestedValue: directionResult.value,
      confidence: directionResult.confidence,
      source: "frequency" as const,
      sourceContext: {
        issuerTaxId: currentDoc.issuerTaxId,
        triggerKey,
      },
    });
  }

  // If no tenant history, try cross-tenant patterns
  if (results.length === 0) {
    return fromCrossTenant(documentId, tenantId);
  }

  return results;
}

/**
 * Suggests defaults from cross-tenant anonymized patterns.
 */
export async function fromCrossTenant(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const [currentDoc] = await db
    .select({ docType: documents.docType })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!currentDoc) return [];

  const fields = ["docType", "direction"];
  const results: SuggestionResult[] = [];

  for (const fieldName of fields) {
    const triggerKey = normalizeTriggerKey(
      "smart_default",
      currentDoc.docType,
      fieldName
    );
    const pattern = await queryCrossTenantPattern({
      patternType: "smart_default",
      triggerKey,
      fieldName,
    });
    if (pattern) {
      results.push({
        feature: "smart_default" as const,
        fieldName,
        suggestedValue: pattern.suggestedValue,
        confidence: pattern.confidence,
        source: "cross_tenant" as const,
        sourceContext: { triggerKey, tenantCount: pattern.tenantCount },
      });
    }
  }

  return results;
}
