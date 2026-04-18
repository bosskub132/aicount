import { and, between, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartOfAccounts, journalEntries, journalLines } from "@/lib/db/schema";

export interface TrialBalanceParams {
  period: string;
  scope: "monthly" | "quarterly" | "yearly";
}

function resolvePeriod(period: string, scope: string): { start: Date; end: Date } {
  const now = new Date();

  if (scope === "yearly") {
    const year = parseInt(period, 10) || now.getFullYear();
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  }

  if (scope === "quarterly") {
    const match = period.match(/^(\d{4})-Q([1-4])$/i);
    if (match) {
      const year = parseInt(match[1], 10);
      const quarter = parseInt(match[2], 10);
      const startMonth = (quarter - 1) * 3;
      return { start: new Date(year, startMonth, 1), end: new Date(year, startMonth + 3, 0) };
    }
    const quarter = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), quarter * 3, 1),
      end: new Date(now.getFullYear(), quarter * 3 + 3, 0),
    };
  }

  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10) || now.getFullYear();
  const month = parseInt(monthStr, 10) || now.getMonth() + 1;
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };
}

export async function getTrialBalance(tenantId: string, params: TrialBalanceParams) {
  const { start, end } = resolvePeriod(params.period, params.scope);

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
      and(
        eq(chartOfAccounts.tenantId, journalEntries.tenantId),
        eq(chartOfAccounts.accountCode, journalLines.accountCode)
      )
    )
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        between(journalEntries.date, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)),
        eq(journalEntries.status, "posted")
      )
    )
    .groupBy(journalLines.accountCode, chartOfAccounts.accountName);

  return {
    period: `${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}`,
    scope: params.scope,
    rows,
  };
}
