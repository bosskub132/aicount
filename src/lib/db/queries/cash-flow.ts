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

interface CashFlowItem {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface CashFlowSection {
  items: CashFlowItem[];
  total: number;
}

export interface CashFlowResult {
  period: PeriodDates;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  unclassifiedAccounts: Array<{ accountCode: string; accountName: string }>;
  comparison?: CashFlowResult;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type CashFlowCategory = "operating" | "investing" | "financing";

/**
 * Computes the net income (revenue - expenses) for the period.
 * This is the starting point for the indirect cash flow method.
 */
async function fetchNetIncome(
  tenantId: string,
  dates: PeriodDates
): Promise<number> {
  const rows = await db
    .select({
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
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        between(journalEntries.date, dates.start, dates.end),
        eq(journalEntries.status, "posted")
      )
    )
    .groupBy(chartOfAccounts.category);

  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const row of rows) {
    const debit = Number(row.totalDebit);
    const credit = Number(row.totalCredit);
    if (row.category === "revenue") totalRevenue += credit - debit;
    if (row.category === "expense") totalExpenses += debit - credit;
  }

  return totalRevenue - totalExpenses;
}

/**
 * Fetches account movements classified by cashFlowCategory.
 * Excludes revenue and expense accounts (those are captured in net income).
 */
async function fetchMovements(tenantId: string, dates: PeriodDates) {
  const rows = await db
    .select({
      accountCode: journalLines.accountCode,
      accountName: chartOfAccounts.accountName,
      category: chartOfAccounts.category,
      cashFlowCategory: chartOfAccounts.cashFlowCategory,
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
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        between(journalEntries.date, dates.start, dates.end),
        eq(journalEntries.status, "posted")
      )
    )
    .groupBy(
      journalLines.accountCode,
      chartOfAccounts.accountName,
      chartOfAccounts.category,
      chartOfAccounts.cashFlowCategory
    );

  return rows;
}

function classifyCashFlowCategory(
  cashFlowCategory: string | null
): CashFlowCategory {
  if (cashFlowCategory === "investing") return "investing";
  if (cashFlowCategory === "financing") return "financing";
  return "operating";
}

function buildSection(items: CashFlowItem[]): CashFlowSection {
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  return { items, total };
}

async function buildResult(
  tenantId: string,
  dates: PeriodDates
): Promise<Omit<CashFlowResult, "comparison">> {
  const netIncome = await fetchNetIncome(tenantId, dates);
  const movements = await fetchMovements(tenantId, dates);

  const buckets: Record<CashFlowCategory, CashFlowItem[]> = {
    operating: [],
    investing: [],
    financing: [],
  };

  // Add net income as the first operating item
  buckets.operating.push({
    accountCode: "",
    accountName: "Net Income \u00B7 \u0E01\u0E33\u0E44\u0E23\u0E2A\u0E38\u0E17\u0E18\u0E34",
    amount: netIncome,
  });

  // Track accounts with no cashFlowCategory assigned
  const unclassifiedAccounts: Array<{ accountCode: string; accountName: string }> = [];

  // Add balance sheet account movements
  for (const row of movements) {
    const category = row.category;
    // Skip income statement accounts — already captured in net income
    if (category === "revenue" || category === "expense") continue;

    const debit = Number(row.totalDebit);
    const credit = Number(row.totalCredit);

    // For assets: increase (debit) is cash outflow (negative)
    // For liabilities/equity: increase (credit) is cash inflow (positive)
    const amount =
      category === "asset" ? -(debit - credit) : credit - debit;

    if (amount === 0) continue;

    // Track accounts where cashFlowCategory is NULL
    if (!row.cashFlowCategory) {
      unclassifiedAccounts.push({
        accountCode: row.accountCode,
        accountName: row.accountName ?? row.accountCode,
      });
    }

    const cfCategory = classifyCashFlowCategory(row.cashFlowCategory);
    buckets[cfCategory].push({
      accountCode: row.accountCode,
      accountName: row.accountName ?? row.accountCode,
      amount,
    });
  }

  const operating = buildSection(buckets.operating);
  const investing = buildSection(buckets.investing);
  const financing = buildSection(buckets.financing);

  return {
    period: dates,
    operating,
    investing,
    financing,
    netCashChange: operating.total + investing.total + financing.total,
    unclassifiedAccounts,
  };
}

// ── Main Query ───────────────────────────────────────────────────────────────

export async function getCashFlow(
  tenantId: string,
  params: {
    period: string;
    scope: string;
    comparison?: string;
  }
): Promise<CashFlowResult> {
  const dates = resolvePeriodDates(params.period, params.scope);
  const result: CashFlowResult = await buildResult(tenantId, dates);

  if (
    params.comparison === "prior_month" ||
    params.comparison === "prior_year"
  ) {
    const compDates = shiftPeriod(dates, params.comparison);
    result.comparison = await buildResult(tenantId, compDates);
  }

  return result;
}
