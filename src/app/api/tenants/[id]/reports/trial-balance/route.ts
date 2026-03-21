import { and, between, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chartOfAccounts, documents, journalLines } from "@/lib/db/schema";
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
  const period = url.searchParams.get("period") || "";
  const [year, month] = period.split("-").map(Number);
  const start = year && month ? new Date(year, month - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

  const rows = await db
    .select({
      accountCode: journalLines.accountCode,
      accountName: chartOfAccounts.accountName,
      totalDebit: sql<number>`sum(${journalLines.debit})`,
      totalCredit: sql<number>`sum(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(documents, eq(journalLines.documentId, documents.id))
    .leftJoin(
      chartOfAccounts,
      and(eq(chartOfAccounts.tenantId, documents.tenantId), eq(chartOfAccounts.accountCode, journalLines.accountCode))
    )
    .where(
      and(
        eq(documents.tenantId, id),
        between(documents.documentDate, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)),
        eq(documents.status, "APPROVED")
      )
    )
    .groupBy(journalLines.accountCode, chartOfAccounts.accountName);

  return NextResponse.json({
    success: true,
    data: {
      period: `${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}`,
      rows,
    },
  });
}

