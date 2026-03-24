import { and, eq, lte, sql } from "drizzle-orm";
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

interface BalanceSheetRow {
  accountCode: string;
  accountName: string;
  balance: number;
}

interface BalanceSheetSection {
  category: string;
  label: string;
  rows: BalanceSheetRow[];
  total: number;
}

export interface BalanceSheetResult {
  asOfDate: string;
  sections: BalanceSheetSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
  comparison?: BalanceSheetResult;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  asset: "Assets \u00B7 \u0E2A\u0E34\u0E19\u0E17\u0E23\u0E31\u0E1E\u0E22\u0E4C",
  liability: "Liabilities \u00B7 \u0E2B\u0E19\u0E35\u0E49\u0E2A\u0E34\u0E19",
  equity: "Equity \u00B7 \u0E2A\u0E48\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E16\u0E37\u0E2D\u0E2B\u0E38\u0E49\u0E19",
};

const SECTION_ORDER: string[] = ["asset", "liability", "equity"];

async function fetchCumulativeBalances(tenantId: string, asOfDate: string) {
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
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        lte(journalEntries.date, asOfDate),
        eq(journalEntries.status, "posted")
      )
    )
    .groupBy(
      journalLines.accountCode,
      chartOfAccounts.accountName,
      chartOfAccounts.category
    );

  return rows;
}

function buildResult(
  asOfDate: string,
  rows: Awaited<ReturnType<typeof fetchCumulativeBalances>>
): Omit<BalanceSheetResult, "comparison"> {
  const buckets: Record<string, BalanceSheetRow[]> = {
    asset: [],
    liability: [],
    equity: [],
  };

  for (const row of rows) {
    const category = row.category;
    if (!category || !buckets[category]) continue;

    const debit = Number(row.totalDebit);
    const credit = Number(row.totalCredit);

    // Assets: debit - credit; Liabilities/Equity: credit - debit
    const balance =
      category === "asset" ? debit - credit : credit - debit;

    if (balance !== 0) {
      buckets[category].push({
        accountCode: row.accountCode,
        accountName: row.accountName ?? row.accountCode,
        balance,
      });
    }
  }

  const totalAssets = buckets.asset.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = buckets.liability.reduce(
    (s, r) => s + r.balance,
    0
  );
  const totalEquity = buckets.equity.reduce((s, r) => s + r.balance, 0);

  const sections: BalanceSheetSection[] = SECTION_ORDER.map((cat) => ({
    category: cat,
    label: SECTION_LABELS[cat],
    rows: buckets[cat],
    total: buckets[cat].reduce((s, r) => s + r.balance, 0),
  }));

  // Use a small epsilon for floating point comparison
  const isBalanced =
    Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return {
    asOfDate,
    sections,
    totalAssets,
    totalLiabilities,
    totalEquity,
    isBalanced,
  };
}

// ── Main Query ───────────────────────────────────────────────────────────────

export async function getBalanceSheet(
  tenantId: string,
  params: {
    period: string;
    scope: string;
    comparison?: string;
  }
): Promise<BalanceSheetResult> {
  const dates = resolvePeriodDates(params.period, params.scope);
  const rows = await fetchCumulativeBalances(tenantId, dates.end);
  const result: BalanceSheetResult = buildResult(dates.end, rows);

  if (
    params.comparison === "prior_month" ||
    params.comparison === "prior_year"
  ) {
    const compDates = shiftPeriod(dates, params.comparison);
    const compRows = await fetchCumulativeBalances(tenantId, compDates.end);
    result.comparison = buildResult(compDates.end, compRows);
  }

  return result;
}
