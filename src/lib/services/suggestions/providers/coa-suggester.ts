import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  documents,
  journalLines,
  journalEntries,
  chartOfAccounts,
} from "@/lib/db/schema";
import { queryCrossTenantPattern } from "@/lib/db/queries/cross-tenant-patterns";
import { normalizeTriggerKey } from "@/lib/services/learning/trigger-keys";
import type { SuggestionResult } from "../types";

/**
 * Suggests a chart-of-accounts mapping based on historical journal lines
 * for the same vendor (matched by issuerTaxId).
 */
export async function fromHistory(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  // 1. Get the current document's issuerTaxId
  const [currentDoc] = await db
    .select({ issuerTaxId: documents.issuerTaxId })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!currentDoc?.issuerTaxId) return [];

  // 2. Find all journal lines for posted entries linked to docs with same vendor
  const rows = await db
    .select({
      accountCode: journalLines.accountCode,
      count: sql<string>`count(*)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .innerJoin(documents, eq(journalEntries.sourceDocumentId, documents.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.status, "posted"),
        eq(documents.issuerTaxId, currentDoc.issuerTaxId)
      )
    )
    .groupBy(journalLines.accountCode)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  if (rows.length === 0) return [];

  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);

  // 3. Look up account names
  const accountCodes = rows.map((r) => r.accountCode);
  const coaRows = await db
    .select({ code: chartOfAccounts.accountCode, name: chartOfAccounts.accountName })
    .from(chartOfAccounts)
    .where(
      and(
        eq(chartOfAccounts.tenantId, tenantId),
        inArray(chartOfAccounts.accountCode, accountCodes)
      )
    );

  const nameMap = new Map(coaRows.map((r) => [r.code, r.name]));

  const triggerKey = normalizeTriggerKey("coa_mapping", currentDoc.issuerTaxId);

  return rows.map((r) => ({
    feature: "coa_mapping" as const,
    fieldName: "accountCode",
    suggestedValue: r.accountCode,
    confidence: Math.min(Number(r.count) / total, 0.95),
    source: "vendor_history" as const,
    sourceContext: {
      accountName: nameMap.get(r.accountCode) ?? null,
      frequency: Number(r.count),
      total,
      triggerKey,
    },
  }));
}

/**
 * Suggests GL account from cross-tenant anonymized patterns.
 */
export async function fromCrossTenant(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const [currentDoc] = await db
    .select({
      issuerTaxId: documents.issuerTaxId,
      docType: documents.docType,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!currentDoc?.issuerTaxId) return [];

  const triggerKey = normalizeTriggerKey(
    "coa_mapping",
    currentDoc.issuerTaxId,
    currentDoc.docType
  );
  const pattern = await queryCrossTenantPattern({
    patternType: "coa_mapping",
    triggerKey,
    fieldName: "accountCode",
  });

  if (!pattern) return [];

  return [
    {
      feature: "coa_mapping" as const,
      fieldName: "accountCode",
      suggestedValue: pattern.suggestedValue,
      confidence: pattern.confidence,
      source: "cross_tenant" as const,
      sourceContext: {
        triggerKey,
        tenantCount: pattern.tenantCount,
        sampleCount: pattern.sampleCount,
      },
    },
  ];
}

/**
 * First tries history-based suggestion. Falls back to Claude Haiku if no history found.
 */
export async function full(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const historyResults = await fromHistory(documentId, tenantId);
  if (historyResults.length > 0) return historyResults;

  // Try cross-tenant patterns before expensive AI call
  const crossTenantResults = await fromCrossTenant(documentId, tenantId);
  if (crossTenantResults.length > 0) return crossTenantResults;

  // Fall back to Claude Haiku AI suggestion
  const [currentDoc] = await db
    .select({
      issuerName: documents.issuerName,
      ocrRaw: documents.ocrRaw,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!currentDoc) return [];

  const coaRows = await db
    .select({
      code: chartOfAccounts.accountCode,
      name: chartOfAccounts.accountName,
      category: chartOfAccounts.category,
    })
    .from(chartOfAccounts)
    .where(
      and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.isActive, true)
      )
    )
    .limit(100);

  const rawOcr = currentDoc.ocrRaw as Record<string, unknown> | null;
  const lineItems = rawOcr?.line_items;
  const lineItemsText = Array.isArray(lineItems)
    ? lineItems.map((li) => JSON.stringify(li)).join("\n")
    : "No line items available";

  const prompt = `You are an accounting assistant for a Thai company. Based on the document line items and chart of accounts, suggest the most appropriate GL account code.

Document from: ${currentDoc.issuerName ?? "Unknown vendor"}

Line items:
${lineItemsText}

Available chart of accounts:
${coaRows.map((a) => `${a.code} - ${a.name} (${a.category})`).join("\n")}

Respond with JSON only: {"accountCode": "XXXX", "confidence": 0.0-1.0, "reason": "brief reason"}`;

  try {
    const { getProvider } = await import("@/lib/services/ai/factory");
    const { calculateCost } = await import("@/lib/services/ai/models");
    const { logAiUsage } = await import(
      "@/lib/services/extraction/usage-logger"
    );

    const model = "claude-haiku-4-5-20251001";
    const provider = getProvider();
    const response = await provider.chat({
      model,
      maxTokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const { inputTokens, outputTokens } = response.usage;
    const costUsd = calculateCost(model, inputTokens, outputTokens);

    await logAiUsage({
      tenantId,
      documentId,
      provider: "anthropic",
      model,
      feature: "coa_suggestion",
      inputTokens,
      outputTokens,
      costUsd,
    });

    let parsed: { accountCode?: string; confidence?: number; reason?: string };
    try {
      parsed = JSON.parse(response.content) as typeof parsed;
    } catch {
      return [];
    }

    if (!parsed.accountCode) return [];

    const matchedAccount = coaRows.find((a) => a.code === parsed.accountCode);

    return [
      {
        feature: "coa_mapping" as const,
        fieldName: "accountCode",
        suggestedValue: parsed.accountCode,
        confidence: Math.min(parsed.confidence ?? 0.5, 0.9),
        source: "ai_model" as const,
        sourceContext: {
          accountName: matchedAccount?.name ?? null,
          reason: parsed.reason ?? null,
          model,
        },
      },
    ];
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error(
      "[coa-suggester] AI suggestion failed:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
