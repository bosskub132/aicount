// DEPRECATED: Use /api/tenants/{id}/reports/tax/pnd3 and /reports/tax/pnd53 instead
import { and, between, eq, sql } from "drizzle-orm";
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

  const ym = new URL(request.url).searchParams.get("year_month") || new Date().toISOString().slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end = new Date(year, month, 0).toISOString().slice(0, 10);

  const grouped = await db
    .select({
      rate: sql<string>`coalesce(((${documents.ocrRaw} -> 'wht' ->> 'rate')), '0')`,
      totalWht: sql<number>`coalesce(sum(${documents.whtAmount}),0)`,
      count: sql<number>`count(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, id),
        eq(documents.status, "APPROVED"),
        between(documents.documentDate, start, end)
      )
    )
    .groupBy(sql`coalesce(((${documents.ocrRaw} -> 'wht' ->> 'rate')), '0')`);

  const totalWht = grouped.reduce((sum, row) => sum + Number(row.totalWht || 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      yearMonth: ym,
      totalWht: Number(totalWht.toFixed(2)),
      byRate: grouped,
    },
  });
}

