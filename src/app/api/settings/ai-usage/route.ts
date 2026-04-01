import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { getTenantUsageSummary } from "@/lib/db/queries/ai-usage";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [summary, prevSummary, tenantData] = await Promise.all([
    getTenantUsageSummary(ctx.tenantId, year, month),
    getTenantUsageSummary(
      ctx.tenantId,
      month === 1 ? year - 1 : year,
      month === 1 ? 12 : month - 1
    ),
    db
      .select({
        monthlyBudgetUsd: tenants.monthlyBudgetUsd,
        budgetAlertThreshold: tenants.budgetAlertThreshold,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1),
  ]);

  const budget = tenantData[0]?.monthlyBudgetUsd
    ? Number(tenantData[0].monthlyBudgetUsd)
    : null;
  const threshold = tenantData[0]?.budgetAlertThreshold
    ? Number(tenantData[0].budgetAlertThreshold)
    : 0.8;

  const costChange =
    prevSummary.totalCostUsd > 0
      ? Math.round(
          ((summary.totalCostUsd - prevSummary.totalCostUsd) /
            prevSummary.totalCostUsd) *
            100
        )
      : null;

  return NextResponse.json({
    success: true,
    data: {
      ...summary,
      costChange,
      budget,
      budgetAlertThreshold: threshold,
      budgetUsedPct: budget ? (summary.totalCostUsd / budget) * 100 : null,
    },
  });
}
