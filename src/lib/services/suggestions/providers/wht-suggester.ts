import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, vendors } from "@/lib/db/schema";
import type { SuggestionResult } from "../types";

/**
 * Suggests WHT rate and income type based on historical documents for the same vendor.
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

  // Find most frequent whtRate for this vendor
  const rateRows = await db
    .select({
      whtRate: documents.whtRate,
      count: sql<string>`count(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.issuerTaxId, currentDoc.issuerTaxId),
        isNotNull(documents.whtRate)
      )
    )
    .groupBy(documents.whtRate)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  // Find most frequent whtIncomeType for this vendor
  const incomeTypeRows = await db
    .select({
      whtIncomeType: documents.whtIncomeType,
      count: sql<string>`count(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.issuerTaxId, currentDoc.issuerTaxId),
        isNotNull(documents.whtIncomeType)
      )
    )
    .groupBy(documents.whtIncomeType)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  const results: SuggestionResult[] = [];

  if (rateRows.length > 0 && rateRows[0].whtRate != null) {
    const totalRates = await db
      .select({ total: sql<string>`count(*)` })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, tenantId),
          eq(documents.issuerTaxId, currentDoc.issuerTaxId),
          isNotNull(documents.whtRate)
        )
      );

    const total = Number(totalRates[0]?.total ?? 1);
    const freq = Number(rateRows[0].count);

    results.push({
      feature: "wht_rate" as const,
      fieldName: "whtRate",
      suggestedValue: String(rateRows[0].whtRate),
      confidence: Math.min(freq / total, 0.95),
      source: "vendor_history" as const,
      sourceContext: { frequency: freq, total },
    });
  }

  if (incomeTypeRows.length > 0 && incomeTypeRows[0].whtIncomeType != null) {
    const totalTypes = await db
      .select({ total: sql<string>`count(*)` })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, tenantId),
          eq(documents.issuerTaxId, currentDoc.issuerTaxId),
          isNotNull(documents.whtIncomeType)
        )
      );

    const total = Number(totalTypes[0]?.total ?? 1);
    const freq = Number(incomeTypeRows[0].count);

    results.push({
      feature: "wht_rate" as const,
      fieldName: "whtIncomeType",
      suggestedValue: String(incomeTypeRows[0].whtIncomeType),
      confidence: Math.min(freq / total, 0.95),
      source: "vendor_history" as const,
      sourceContext: { frequency: freq, total },
    });
  }

  return results;
}

/**
 * Suggests default WHT rate based on vendor type (individual vs company).
 * Confidence 0.6 — lower than history because it's a general rule.
 */
export async function fromVendorType(
  documentId: string,
  tenantId: string
): Promise<SuggestionResult[]> {
  const [currentDoc] = await db
    .select({ issuerTaxId: documents.issuerTaxId })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!currentDoc?.issuerTaxId) return [];

  const [vendor] = await db
    .select({ vendorType: vendors.vendorType, defaultWhtRate: vendors.defaultWhtRate })
    .from(vendors)
    .where(
      and(
        eq(vendors.tenantId, tenantId),
        eq(vendors.taxId, currentDoc.issuerTaxId)
      )
    )
    .limit(1);

  if (!vendor) return [];

  // Default WHT rates: individual = 3%, company = 3% (overrideable by defaultWhtRate)
  const defaultRate =
    vendor.defaultWhtRate != null ? String(vendor.defaultWhtRate) : "3.00";

  return [
    {
      feature: "wht_rate" as const,
      fieldName: "whtRate",
      suggestedValue: defaultRate,
      confidence: 0.6,
      source: "graduated_rule" as const,
      sourceContext: {
        vendorType: vendor.vendorType,
        defaultWhtRate: defaultRate,
      },
    },
  ];
}
