import { and, eq, gte, desc, sql, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { crossTenantPatterns, tenants } from "@/lib/db/schema";
import type {
  AdaptiveThresholds,
  CrossTenantPattern,
  PatternMetadata,
} from "@/lib/services/learning/types";

export async function getTotalTenantCount(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(tenants)
    .where(sql`${tenants.deletedAt} IS NULL`);
  return result[0]?.count ?? 0;
}

export function getMinThresholds(totalTenants: number): AdaptiveThresholds {
  if (totalTenants < 10) return { minTenants: 3, minAgreement: 0.6 };
  if (totalTenants < 50) return { minTenants: 5, minAgreement: 0.65 };
  if (totalTenants < 200) return { minTenants: 8, minAgreement: 0.7 };
  return { minTenants: 10, minAgreement: 0.75 };
}

export async function queryCrossTenantPattern(params: {
  patternType: string;
  triggerKey: string;
  fieldName: string;
}): Promise<CrossTenantPattern | null> {
  const totalTenants = await getTotalTenantCount();
  const thresholds = getMinThresholds(totalTenants);

  const rows = await db
    .select()
    .from(crossTenantPatterns)
    .where(
      and(
        eq(crossTenantPatterns.patternType, params.patternType),
        eq(crossTenantPatterns.triggerKey, params.triggerKey),
        eq(crossTenantPatterns.fieldName, params.fieldName),
        gte(crossTenantPatterns.tenantCount, thresholds.minTenants),
        gte(
          crossTenantPatterns.agreementRatio,
          String(thresholds.minAgreement)
        )
      )
    )
    .orderBy(desc(crossTenantPatterns.confidence))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    patternType: row.patternType as CrossTenantPattern["patternType"],
    triggerKey: row.triggerKey,
    fieldName: row.fieldName,
    suggestedValue: row.suggestedValue,
    tenantCount: row.tenantCount,
    sampleCount: row.sampleCount,
    acceptCount: row.acceptCount,
    dismissCount: row.dismissCount,
    agreementRatio: Number(row.agreementRatio),
    confidence: Number(row.confidence),
    metadata: row.metadata as PatternMetadata | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function calculateConfidence(
  tenantCount: number,
  sampleCount: number,
  agreementRatio: number
): number {
  const volumeFactor = Math.min(
    1.0,
    Math.log10(tenantCount + 1) / Math.log10(21)
  );
  const sampleFactor = Math.min(1.0, sampleCount / 50);
  const raw = agreementRatio * 0.5 + volumeFactor * 0.3 + sampleFactor * 0.2;
  return Math.round(raw * 100) / 100;
}

export async function upsertPattern(params: {
  patternType: string;
  triggerKey: string;
  fieldName: string;
  suggestedValue: string;
  isAccepted: boolean;
  tenantHash: string;
}): Promise<void> {
  const {
    patternType,
    triggerKey,
    fieldName,
    suggestedValue,
    isAccepted,
    tenantHash,
  } = params;

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(crossTenantPatterns)
      .where(
        and(
          eq(crossTenantPatterns.patternType, patternType),
          eq(crossTenantPatterns.triggerKey, triggerKey),
          eq(crossTenantPatterns.fieldName, fieldName),
          eq(crossTenantPatterns.suggestedValue, suggestedValue)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const meta = (row.metadata ?? { tenantHashes: [] }) as PatternMetadata;
      const tenantHashes = meta.tenantHashes ?? [];
      const isNewTenant = !tenantHashes.includes(tenantHash);

      const newSampleCount = row.sampleCount + 1;
      const newAcceptCount = row.acceptCount + (isAccepted ? 1 : 0);
      const newDismissCount = row.dismissCount + (isAccepted ? 0 : 1);
      const newTenantHashes = isNewTenant
        ? [...tenantHashes, tenantHash]
        : tenantHashes;
      const newTenantCount = newTenantHashes.length;
      const newAgreementRatio = newAcceptCount / newSampleCount;
      const newConfidence = calculateConfidence(
        newTenantCount,
        newSampleCount,
        newAgreementRatio
      );

      await tx
        .update(crossTenantPatterns)
        .set({
          sampleCount: newSampleCount,
          acceptCount: newAcceptCount,
          dismissCount: newDismissCount,
          tenantCount: newTenantCount,
          agreementRatio: String(newAgreementRatio),
          confidence: String(newConfidence),
          metadata: { ...meta, tenantHashes: newTenantHashes },
          updatedAt: new Date(),
        })
        .where(eq(crossTenantPatterns.id, row.id));
    } else {
      const agreementRatio = isAccepted ? 1.0 : 0.0;
      const confidence = calculateConfidence(1, 1, agreementRatio);

      await tx.insert(crossTenantPatterns).values({
        patternType,
        triggerKey,
        fieldName,
        suggestedValue,
        tenantCount: 1,
        sampleCount: 1,
        acceptCount: isAccepted ? 1 : 0,
        dismissCount: isAccepted ? 0 : 1,
        agreementRatio: String(agreementRatio),
        confidence: String(confidence),
        metadata: { tenantHashes: [tenantHash] },
      });
    }
  });
}
