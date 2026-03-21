import { and, eq, gte, sql } from "drizzle-orm";
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

  const months = Number(new URL(request.url).searchParams.get("months") || 6);
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);

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
    data: {
      months,
      from: start.toISOString().slice(0, 10),
      rows,
    },
  });
}

