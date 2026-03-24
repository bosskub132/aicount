// DEPRECATED: Use /api/tenants/{id}/reports/tax/pp30 instead
/* eslint-disable @typescript-eslint/no-explicit-any */
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

  const [salesVat, purchaseVat] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${documents.vatAmount}),0)` })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, id),
          eq(documents.direction, "REVENUE" as any),
          eq(documents.status, "APPROVED"),
          between(documents.documentDate, start, end)
        )
      ),
    db
      .select({ total: sql<number>`coalesce(sum(${documents.vatAmount}),0)` })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, id),
          eq(documents.direction, "EXPENSE" as any),
          eq(documents.status, "APPROVED"),
          between(documents.documentDate, start, end)
        )
      ),
  ]);

  const outputVat = Number(salesVat[0]?.total || 0);
  const inputVat = Number(purchaseVat[0]?.total || 0);

  return NextResponse.json({
    success: true,
    data: {
      yearMonth: ym,
      outputVat,
      inputVat,
      netVatPayable: Number((outputVat - inputVat).toFixed(2)),
    },
  });
}

