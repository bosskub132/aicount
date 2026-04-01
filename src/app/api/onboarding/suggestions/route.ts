import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { crossTenantPatterns } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import {
  getMinThresholds,
  getTotalTenantCount,
} from "@/lib/db/queries/cross-tenant-patterns";

interface OnboardingSuggestion {
  fieldName: string;
  suggestedValue: string;
  confidence: number;
  context?: string;
  vendorTaxId?: string;
}

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step")?.slice(0, 50);

  const totalTenants = await getTotalTenantCount();
  const thresholds = getMinThresholds(totalTenants);

  const suggestions: OnboardingSuggestion[] = [];

  if (step === "coa") {
    // Return top cross-tenant GL account patterns
    const patterns = await db
      .select()
      .from(crossTenantPatterns)
      .where(
        and(
          eq(crossTenantPatterns.patternType, "coa_mapping"),
          eq(crossTenantPatterns.fieldName, "accountCode")
        )
      )
      .orderBy(desc(crossTenantPatterns.confidence))
      .limit(10);

    for (const p of patterns) {
      if (
        p.tenantCount >= thresholds.minTenants &&
        Number(p.agreementRatio) >= thresholds.minAgreement
      ) {
        suggestions.push({
          fieldName: "accountCode",
          suggestedValue: p.suggestedValue,
          confidence: Number(p.confidence),
          context: p.triggerKey,
        });
      }
    }
  }

  if (step === "vendors") {
    const vendorTaxIds =
      searchParams
        .get("vendorTaxIds")
        ?.slice(0, 500)
        .split(",")
        .filter(Boolean)
        .slice(0, 10) ?? [];

    for (const taxId of vendorTaxIds) {
      const patterns = await db
        .select()
        .from(crossTenantPatterns)
        .where(
          and(
            eq(crossTenantPatterns.patternType, "wht_rate"),
            eq(crossTenantPatterns.fieldName, "whtRate")
          )
        )
        .orderBy(desc(crossTenantPatterns.confidence))
        .limit(1);

      for (const p of patterns) {
        if (
          p.tenantCount >= thresholds.minTenants &&
          Number(p.agreementRatio) >= thresholds.minAgreement
        ) {
          suggestions.push({
            vendorTaxId: taxId,
            fieldName: "whtRate",
            suggestedValue: p.suggestedValue,
            confidence: Number(p.confidence),
          });
        }
      }
    }
  }

  return NextResponse.json({ suggestions });
}
