import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export interface MonthlyComparisonRow {
  yearMonth: string;
  revenueAmount: number;
  expenseAmount: number;
  docCount: number;
}

export interface MonthlyComparisonResult {
  months: number;
  from: string;
  rows: MonthlyComparisonRow[];
}

export async function getMonthlyComparison(
  tenantId: string,
  months: number
): Promise<MonthlyComparisonResult> {
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);
  const from = start.toISOString().slice(0, 10);

  const rows = await db
    .select({
      yearMonth: sql<string>`to_char(${documents.documentDate}::date, 'YYYY-MM')`,
      revenueAmount: sql<number>`coalesce(sum(case when ${documents.direction}='REVENUE' then ${documents.grandTotal}::numeric else 0 end),0)`,
      expenseAmount: sql<number>`coalesce(sum(case when ${documents.direction}='EXPENSE' then ${documents.grandTotal}::numeric else 0 end),0)`,
      docCount: sql<number>`count(*)::int`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "APPROVED"),
        gte(documents.documentDate, from)
      )
    )
    .groupBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM') asc`);

  return { months, from, rows };
}
