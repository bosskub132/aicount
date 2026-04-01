import { and, eq, gte, lt, sql, count, sum, countDistinct, desc, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsageLogs, tenants } from "@/lib/db/schema";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface TenantUsageSummary {
  documentCount: number;
  totalCostUsd: number;
  avgCostPerDoc: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
}

export interface PlatformOverview {
  totalCostUsd: number;
  totalDocuments: number;
  activeTenants: number;
  avgCostPerDoc: number;
}

export interface DailyCostPoint {
  date: string;
  dailyCost: number;
  cumulativeCost: number;
}

export interface TenantUsageRow {
  tenantId: string;
  tenantName: string;
  documentCount: number;
  totalCostUsd: number;
  avgCostPerDoc: number;
  monthlyBudgetUsd: number | null;
  budgetUsedPct: number | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getTenantUsageSummary(
  tenantId: string,
  year: number,
  month: number
): Promise<TenantUsageSummary> {
  const { start, end } = getMonthRange(year, month);

  const [result] = await db
    .select({
      documentCount: count(),
      totalCostUsd: sum(aiUsageLogs.costUsd),
      tier1Count: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 1)`,
      tier2Count: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 2)`,
      tier3Count: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 3)`,
    })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.tenantId, tenantId),
        gte(aiUsageLogs.createdAt, start),
        lt(aiUsageLogs.createdAt, end)
      )
    );

  const documentCount = Number(result?.documentCount ?? 0);
  const totalCostUsd = Number(result?.totalCostUsd ?? 0);

  return {
    documentCount,
    totalCostUsd,
    avgCostPerDoc: documentCount > 0 ? totalCostUsd / documentCount : 0,
    tier1Count: Number(result?.tier1Count ?? 0),
    tier2Count: Number(result?.tier2Count ?? 0),
    tier3Count: Number(result?.tier3Count ?? 0),
  };
}

export async function getPlatformOverview(
  year: number,
  month: number
): Promise<PlatformOverview> {
  const { start, end } = getMonthRange(year, month);

  const [result] = await db
    .select({
      totalCostUsd: sum(aiUsageLogs.costUsd),
      totalDocuments: count(),
      activeTenants: countDistinct(aiUsageLogs.tenantId),
    })
    .from(aiUsageLogs)
    .where(
      and(
        gte(aiUsageLogs.createdAt, start),
        lt(aiUsageLogs.createdAt, end)
      )
    );

  const totalDocuments = Number(result?.totalDocuments ?? 0);
  const totalCostUsd = Number(result?.totalCostUsd ?? 0);

  return {
    totalCostUsd,
    totalDocuments,
    activeTenants: Number(result?.activeTenants ?? 0),
    avgCostPerDoc: totalDocuments > 0 ? totalCostUsd / totalDocuments : 0,
  };
}

export async function getDailyCosts(
  year: number,
  month: number
): Promise<DailyCostPoint[]> {
  const { start, end } = getMonthRange(year, month);

  const rows = await db
    .select({
      date: sql<string>`DATE(${aiUsageLogs.createdAt})::text`,
      dailyCost: sum(aiUsageLogs.costUsd),
    })
    .from(aiUsageLogs)
    .where(
      and(
        gte(aiUsageLogs.createdAt, start),
        lt(aiUsageLogs.createdAt, end)
      )
    )
    .groupBy(sql`DATE(${aiUsageLogs.createdAt})`)
    .orderBy(sql`DATE(${aiUsageLogs.createdAt})`);

  let cumulative = 0;
  return rows.map((row) => {
    const daily = Number(row.dailyCost ?? 0);
    cumulative += daily;
    return {
      date: row.date,
      dailyCost: daily,
      cumulativeCost: cumulative,
    };
  });
}

export interface TierBreakdown {
  tier1: number;
  tier2: number;
  tier3: number;
}

export async function getTierBreakdown(
  year: number,
  month: number
): Promise<TierBreakdown> {
  const { start, end } = getMonthRange(year, month);

  const [result] = await db
    .select({
      tier1: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 1)`,
      tier2: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 2)`,
      tier3: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogs.tier} = 3)`,
    })
    .from(aiUsageLogs)
    .where(
      and(
        gte(aiUsageLogs.createdAt, start),
        lt(aiUsageLogs.createdAt, end)
      )
    );

  return {
    tier1: Number(result?.tier1 ?? 0),
    tier2: Number(result?.tier2 ?? 0),
    tier3: Number(result?.tier3 ?? 0),
  };
}

export async function getPerTenantUsage(
  year: number,
  month: number,
  search?: string,
  page = 1,
  limit = 20
): Promise<{ rows: TenantUsageRow[]; total: number }> {
  const { start, end } = getMonthRange(year, month);
  const offset = (page - 1) * limit;

  const baseWhere = and(
    gte(aiUsageLogs.createdAt, start),
    lt(aiUsageLogs.createdAt, end),
    search ? ilike(tenants.name, `%${search}%`) : undefined
  );

  const [countResult] = await db
    .select({ total: countDistinct(aiUsageLogs.tenantId) })
    .from(aiUsageLogs)
    .innerJoin(tenants, eq(aiUsageLogs.tenantId, tenants.id))
    .where(baseWhere);

  const rows = await db
    .select({
      tenantId: aiUsageLogs.tenantId,
      tenantName: tenants.name,
      documentCount: count(),
      totalCostUsd: sum(aiUsageLogs.costUsd),
      monthlyBudgetUsd: tenants.monthlyBudgetUsd,
    })
    .from(aiUsageLogs)
    .innerJoin(tenants, eq(aiUsageLogs.tenantId, tenants.id))
    .where(baseWhere)
    .groupBy(aiUsageLogs.tenantId, tenants.name, tenants.monthlyBudgetUsd)
    .orderBy(desc(sum(aiUsageLogs.costUsd)))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((row) => {
      const docCount = Number(row.documentCount ?? 0);
      const totalCost = Number(row.totalCostUsd ?? 0);
      const budget = row.monthlyBudgetUsd !== null ? Number(row.monthlyBudgetUsd) : null;
      return {
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        documentCount: docCount,
        totalCostUsd: totalCost,
        avgCostPerDoc: docCount > 0 ? totalCost / docCount : 0,
        monthlyBudgetUsd: budget,
        budgetUsedPct: budget !== null && budget > 0 ? (totalCost / budget) * 100 : null,
      };
    }),
    total: Number(countResult?.total ?? 0),
  };
}
