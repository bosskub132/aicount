import { and, between, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  chartOfAccounts,
  journalEntries,
  journalLines,
} from "@/lib/db/schema";
import {
  type PeriodDates,
  resolvePeriodDates,
  shiftPeriod,
} from "./period-utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProfitLossRow {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface ProfitLossSection {
  category: string;
  label: string;
  rows: ProfitLossRow[];
  total: number;
}

export interface ProfitLossResult {
  period: PeriodDates;
  sections: ProfitLossSection[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  comparison?: ProfitLossResult;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  revenue: "Revenue \u00B7 \u0E23\u0E32\u0E22\u0E44\u0E14\u0E49",
  expense: "Expenses \u00B7 \u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22",
};

async function fetchPeriodData(
  tenantId: string,
  dates: PeriodDates,
  department?: string
) {
  const conditions = [
    eq(journalEntries.tenantId, tenantId),
    between(journalEntries.date, dates.start, dates.end),
    eq(journalEntries.status, "posted"),
  ];

  if (department) {
    conditions.push(eq(journalLines.deptCode, department));
  }

  const rows = await db
    .select({
      accountCode: journalLines.accountCode,
      accountName: chartOfAccounts.accountName,
      category: chartOfAccounts.category,
      totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .leftJoin(
      chartOfAccounts,
      and(
        eq(chartOfAccounts.tenantId, journalEntries.tenantId),
        eq(chartOfAccounts.accountCode, journalLines.accountCode)
      )
    )
    .where(and(...conditions))
    .groupBy(
      journalLines.accountCode,
      chartOfAccounts.accountName,
      chartOfAccounts.category
    );

  return rows;
}

function buildResult(
  dates: PeriodDates,
  rows: Awaited<ReturnType<typeof fetchPeriodData>>
): Omit<ProfitLossResult, "comparison"> {
  const revenueRows: ProfitLossRow[] = [];
  const expenseRows: ProfitLossRow[] = [];

  for (const row of rows) {
    const debit = Number(row.totalDebit);
    const credit = Number(row.totalCredit);

    if (row.category === "revenue") {
      const amount = credit - debit;
      if (amount !== 0) {
        revenueRows.push({
          accountCode: row.accountCode,
          accountName: row.accountName ?? row.accountCode,
          amount,
        });
      }
    } else if (row.category === "expense") {
      const amount = debit - credit;
      if (amount !== 0) {
        expenseRows.push({
          accountCode: row.accountCode,
          accountName: row.accountName ?? row.accountCode,
          amount,
        });
      }
    }
  }

  const totalRevenue = revenueRows.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenseRows.reduce((sum, r) => sum + r.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue !== 0 ? netProfit / totalRevenue : 0;

  const sections: ProfitLossSection[] = [
    {
      category: "revenue",
      label: SECTION_LABELS.revenue,
      rows: revenueRows,
      total: totalRevenue,
    },
    {
      category: "expense",
      label: SECTION_LABELS.expense,
      rows: expenseRows,
      total: totalExpenses,
    },
  ];

  return {
    period: dates,
    sections,
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
  };
}

// ── Main Query ───────────────────────────────────────────────────────────────

export async function getProfitLoss(
  tenantId: string,
  params: {
    period: string;
    scope: string;
    department?: string;
    comparison?: string;
  }
): Promise<ProfitLossResult> {
  const dates = resolvePeriodDates(params.period, params.scope);
  const rows = await fetchPeriodData(tenantId, dates, params.department);
  const result: ProfitLossResult = buildResult(dates, rows);

  if (
    params.comparison === "prior_month" ||
    params.comparison === "prior_year"
  ) {
    const compDates = shiftPeriod(dates, params.comparison);
    const compRows = await fetchPeriodData(
      tenantId,
      compDates,
      params.department
    );
    result.comparison = buildResult(compDates, compRows);
  }

  return result;
}
