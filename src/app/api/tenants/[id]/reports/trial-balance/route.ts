import { and, between, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chartOfAccounts, journalEntries, journalLines } from "@/lib/db/schema";
import { ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

function resolvePeriod(period: string, scope: string): { start: Date; end: Date } {
  const now = new Date();

  if (scope === "yearly") {
    const year = parseInt(period, 10) || now.getFullYear();
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
    };
  }

  if (scope === "quarterly") {
    const match = period.match(/^(\d{4})-Q([1-4])$/i);
    if (match) {
      const year = parseInt(match[1], 10);
      const quarter = parseInt(match[2], 10);
      const startMonth = (quarter - 1) * 3;
      return {
        start: new Date(year, startMonth, 1),
        end: new Date(year, startMonth + 3, 0),
      };
    }
    // Fallback: current quarter
    const quarter = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), quarter * 3, 1),
      end: new Date(now.getFullYear(), quarter * 3 + 3, 0),
    };
  }

  // Default: monthly
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10) || now.getFullYear();
  const month = parseInt(monthStr, 10) || now.getMonth() + 1;
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0),
  };
}

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
  const scope = url.searchParams.get("scope") || "monthly";

  if (!["monthly", "quarterly", "yearly"].includes(scope)) {
    return NextResponse.json(
      { success: false, error: "Invalid scope. Must be monthly, quarterly, or yearly." },
      { status: 400 }
    );
  }

  const { start, end } = resolvePeriod(period, scope);

  const rows = await db
    .select({
      accountCode: journalLines.accountCode,
      accountName: chartOfAccounts.accountName,
      totalDebit: sql<number>`sum(${journalLines.debit})`,
      totalCredit: sql<number>`sum(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .leftJoin(
      chartOfAccounts,
      and(eq(chartOfAccounts.tenantId, journalEntries.tenantId), eq(chartOfAccounts.accountCode, journalLines.accountCode))
    )
    .where(
      and(
        eq(journalEntries.tenantId, id),
        between(journalEntries.date, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)),
        eq(journalEntries.status, "posted")
      )
    )
    .groupBy(journalLines.accountCode, chartOfAccounts.accountName);

  return NextResponse.json({
    success: true,
    data: {
      period: `${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}`,
      scope,
      rows,
    },
  });
}
