import { and, eq, lt, gte, lte, asc, sql, sum, ne } from "drizzle-orm";
import { journalEntries, journalLines } from "@/lib/db/schema";

// ── Types ───────────────────────────────────────────────────────────────────

type Db = typeof import("@/lib/db").db;

export interface LedgerTransaction {
  date: string;
  jvNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AccountLedgerResult {
  openingBalance: number;
  transactions: LedgerTransaction[];
  closingBalance: number;
  periodDebits: number;
  periodCredits: number;
  netMovement: number;
}

// ── Query ───────────────────────────────────────────────────────────────────

export async function getAccountLedger(
  db: Db,
  tenantId: string,
  accountCode: string,
  dateFrom: string,
  dateTo: string
): Promise<AccountLedgerResult> {
  // Opening balance: sum of (debit - credit) for all lines with this accountCode
  // where the journal entry date < dateFrom and status != 'reversed'
  const [openingResult] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(CAST(${journalLines.debit} AS numeric) - CAST(${journalLines.credit} AS numeric)), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalLines.accountCode, accountCode),
        lt(journalEntries.date, dateFrom),
        ne(journalEntries.status, "reversed")
      )
    );

  const openingBalance = Number(openingResult?.balance ?? 0);

  // Period transactions: lines joined with entries, filtered by date range
  const rows = await db
    .select({
      date: journalEntries.date,
      jvNumber: journalEntries.jvNumber,
      entryDescription: journalEntries.description,
      lineDescription: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      createdAt: journalEntries.createdAt,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalLines.accountCode, accountCode),
        gte(journalEntries.date, dateFrom),
        lte(journalEntries.date, dateTo),
        ne(journalEntries.status, "reversed")
      )
    )
    .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt));

  // Build transactions with running balance
  let runningBalance = openingBalance;
  let periodDebits = 0;
  let periodCredits = 0;

  const transactions: LedgerTransaction[] = rows.map((row) => {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    runningBalance = runningBalance + debit - credit;
    periodDebits += debit;
    periodCredits += credit;

    return {
      date: row.date,
      jvNumber: row.jvNumber,
      description: row.lineDescription ?? row.entryDescription,
      debit,
      credit,
      runningBalance,
    };
  });

  const netMovement = periodDebits - periodCredits;
  const closingBalance = openingBalance + netMovement;

  return {
    openingBalance,
    transactions,
    closingBalance,
    periodDebits,
    periodCredits,
    netMovement,
  };
}
