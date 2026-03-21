/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, lte, sql } from "drizzle-orm";
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
  const type = (url.searchParams.get("type") || "ap").toLowerCase(); // ap/ar
  const now = new Date();
  const cut90 = new Date(now);
  cut90.setDate(cut90.getDate() - 90);

  const direction = type === "ar" ? "REVENUE" : "EXPENSE";
  const rows = await db
    .select({
      bucket: sql<string>`
        CASE
          WHEN ${documents.documentDate} >= CURRENT_DATE - INTERVAL '30 day' THEN '0-30'
          WHEN ${documents.documentDate} >= CURRENT_DATE - INTERVAL '60 day' THEN '31-60'
          WHEN ${documents.documentDate} >= CURRENT_DATE - INTERVAL '90 day' THEN '61-90'
          ELSE '90+'
        END
      `,
      totalAmount: sql<number>`sum(${documents.grandTotal})`,
      count: sql<number>`count(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, id),
        eq(documents.direction, direction as any),
        eq(documents.status, "APPROVED"),
        lte(documents.documentDate, now.toISOString().slice(0, 10))
      )
    )
    .groupBy(
      sql`
        CASE
          WHEN ${documents.documentDate} >= CURRENT_DATE - INTERVAL '30 day' THEN '0-30'
          WHEN ${documents.documentDate} >= CURRENT_DATE - INTERVAL '60 day' THEN '31-60'
          WHEN ${documents.documentDate} >= CURRENT_DATE - INTERVAL '90 day' THEN '61-90'
          ELSE '90+'
        END
      `
    );

  return NextResponse.json({
    success: true,
    data: {
      type,
      asOf: now.toISOString().slice(0, 10),
      olderThan90Since: cut90.toISOString().slice(0, 10),
      buckets: rows,
    },
  });
}

