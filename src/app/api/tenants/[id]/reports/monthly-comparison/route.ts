import { and, between, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const monthsParam = url.searchParams.get("months");

  // If year is provided, return 12 months for that year; otherwise use legacy months param
  if (yearParam) {
    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Invalid year. Must be between 2000 and 2100." }, { status: 400 });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    try {
      const rows = await db
        .select({
          yearMonth: sql<string>`to_char(${documents.documentDate}::date, 'YYYY-MM')`,
          revenueAmount: sql<number>`coalesce(sum(case when ${documents.direction}='REVENUE' then ${documents.grandTotal}::numeric else 0 end),0)`,
          expenseAmount: sql<number>`coalesce(sum(case when ${documents.direction}='EXPENSE' then ${documents.grandTotal}::numeric else 0 end),0)`,
          docCount: sql<number>`count(*)`,
        })
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, id),
            eq(documents.status, "APPROVED"),
            between(documents.documentDate, startDate, endDate)
          )
        )
        .groupBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM')`)
        .orderBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM') asc`);

      // Build full 12-month grid; future months show null amounts
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const rowMap = new Map(rows.map((r) => [r.yearMonth, r]));

      const months = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        const ym = `${year}-${m}`;
        const isFuture = ym > currentYearMonth;
        const existing = rowMap.get(ym);
        return {
          yearMonth: ym,
          revenueAmount: isFuture ? null : (existing?.revenueAmount ?? 0),
          expenseAmount: isFuture ? null : (existing?.expenseAmount ?? 0),
          docCount: isFuture ? null : (existing?.docCount ?? 0),
        };
      });

      return NextResponse.json({
        success: true,
        data: { year, from: startDate, to: endDate, rows: months },
      });
    } catch (err) {
      console.error("[reports/monthly-comparison] Error:", err);
      return NextResponse.json({ success: false, error: "Failed to generate monthly comparison" }, { status: 500 });
    }
  }

  // Legacy mode: rolling N months
  const rawMonths = parseInt(monthsParam || "6", 10);
  const months = (!isNaN(rawMonths) && rawMonths >= 1 && rawMonths <= 36) ? rawMonths : 6;
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);

  try {
    const rows = await db
      .select({
        yearMonth: sql<string>`to_char(${documents.documentDate}::date, 'YYYY-MM')`,
        revenueAmount: sql<number>`coalesce(sum(case when ${documents.direction}='REVENUE' then ${documents.grandTotal}::numeric else 0 end),0)`,
        expenseAmount: sql<number>`coalesce(sum(case when ${documents.direction}='EXPENSE' then ${documents.grandTotal}::numeric else 0 end),0)`,
        docCount: sql<number>`count(*)`,
      })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, id),
          eq(documents.status, "APPROVED"),
          gte(documents.documentDate, start.toISOString().slice(0, 10))
        )
      )
      .groupBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM') asc`);

    return NextResponse.json({
      success: true,
      data: { months, from: start.toISOString().slice(0, 10), rows },
    });
  } catch (err) {
    console.error("[reports/monthly-comparison] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to generate monthly comparison" }, { status: 500 });
  }
}

