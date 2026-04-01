import { NextRequest, NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
} from "@/lib/api/request-context";
import { db } from "@/lib/db";
import { crossTenantPatterns, aiSuggestions } from "@/lib/db/schema";
import { count, eq, sql } from "drizzle-orm";
import {
  getMinThresholds,
  getTotalTenantCount,
} from "@/lib/db/queries/cross-tenant-patterns";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  if (!ctx.isSuperadmin) return forbidden("Superadmin access required");

  const totalTenants = await getTotalTenantCount();
  const thresholds = getMinThresholds(totalTenants);

  const [totalPatterns, activePatterns, crossTenantSuggestions, totalSuggestions] =
    await Promise.all([
      db.select({ count: count() }).from(crossTenantPatterns),
      db
        .select({ count: count() })
        .from(crossTenantPatterns)
        .where(
          sql`${crossTenantPatterns.tenantCount} >= ${thresholds.minTenants} AND CAST(${crossTenantPatterns.agreementRatio} AS NUMERIC) >= ${thresholds.minAgreement}`
        ),
      db
        .select({ count: count() })
        .from(aiSuggestions)
        .where(eq(aiSuggestions.source, "cross_tenant")),
      db.select({ count: count() }).from(aiSuggestions),
    ]);

  const total = totalPatterns[0]?.count ?? 0;
  const active = activePatterns[0]?.count ?? 0;
  const crossTenantCount = crossTenantSuggestions[0]?.count ?? 0;
  const totalCount = totalSuggestions[0]?.count ?? 0;
  const coverage =
    totalCount > 0
      ? Math.round((crossTenantCount / totalCount) * 100)
      : 0;

  return NextResponse.json({
    totalPatterns: total,
    activePatterns: active,
    coverage,
    thresholds,
  });
}
