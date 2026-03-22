import {
  and,
  eq,
  gte,
  lte,
  sql,
  isNull,
  notInArray,
} from "drizzle-orm";
import {
  bankStatements,
  bankTransactions,
  bankReconMatches,
  journalEntries,
  journalLines,
} from "@/lib/db/schema";

// ── Types ───────────────────────────────────────────────────────────────────

type Db = typeof import("@/lib/db").db;

export interface ReconSummary {
  statementBalance: number;
  glBalance: number;
  difference: number;
  matchedCount: number;
  unmatchedCount: number;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get unmatched bank transactions for a statement.
 */
export async function getUnmatchedBankTransactions(
  db: Db,
  tenantId: string,
  bankStatementId: string,
) {
  // Get all transaction IDs that are already matched
  const matchedIds = db
    .select({ id: bankReconMatches.bankTransactionId })
    .from(bankReconMatches)
    .where(eq(bankReconMatches.tenantId, tenantId));

  return await db
    .select({
      id: bankTransactions.id,
      bankStatementId: bankTransactions.bankStatementId,
      transactionDate: bankTransactions.transactionDate,
      description: bankTransactions.description,
      debit: bankTransactions.debit,
      credit: bankTransactions.credit,
      referenceNo: bankTransactions.referenceNo,
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankStatementId, bankStatementId),
        notInArray(bankTransactions.id, matchedIds),
      ),
    );
}

/**
 * Get all bank transactions for a statement, with matched status.
 */
export async function getAllBankTransactions(
  db: Db,
  tenantId: string,
  bankStatementId: string,
) {
  return await db
    .select({
      id: bankTransactions.id,
      bankStatementId: bankTransactions.bankStatementId,
      transactionDate: bankTransactions.transactionDate,
      description: bankTransactions.description,
      debit: bankTransactions.debit,
      credit: bankTransactions.credit,
      referenceNo: bankTransactions.referenceNo,
      matchId: bankReconMatches.id,
      matchedJournalEntryId: bankReconMatches.journalEntryId,
      matchType: bankReconMatches.matchType,
      confidence: bankReconMatches.confidence,
      confirmedAt: bankReconMatches.confirmedAt,
    })
    .from(bankTransactions)
    .leftJoin(
      bankReconMatches,
      and(
        eq(bankReconMatches.bankTransactionId, bankTransactions.id),
        eq(bankReconMatches.tenantId, tenantId),
      ),
    )
    .where(eq(bankTransactions.bankStatementId, bankStatementId));
}

/**
 * Get unmatched GL entries for a bank account within a date range.
 * Filters journalLines by accountCode = bankAccountCode, joined with journalEntries.
 * Excludes entries already matched in bankReconMatches.
 */
export async function getUnmatchedGLEntries(
  db: Db,
  tenantId: string,
  bankAccountCode: string,
  dateFrom: string,
  dateTo: string,
) {
  // Get journal entry IDs that are already matched
  const matchedEntryIds = db
    .select({ id: bankReconMatches.journalEntryId })
    .from(bankReconMatches)
    .where(eq(bankReconMatches.tenantId, tenantId));

  return await db
    .select({
      journalEntryId: journalEntries.id,
      date: journalEntries.date,
      jvNumber: journalEntries.jvNumber,
      description: journalEntries.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.status, "posted"),
        eq(journalLines.accountCode, bankAccountCode),
        gte(journalEntries.date, dateFrom),
        lte(journalEntries.date, dateTo),
        notInArray(journalEntries.id, matchedEntryIds),
      ),
    );
}

/**
 * Create a match between a bank transaction and a journal entry.
 */
export async function createMatch(
  db: Db,
  tenantId: string,
  bankTransactionId: string,
  journalEntryId: string,
  matchType: "auto" | "manual",
  confidence?: number,
) {
  const [match] = await db
    .insert(bankReconMatches)
    .values({
      tenantId,
      bankTransactionId,
      journalEntryId,
      matchType,
      confidence: confidence?.toFixed(2) ?? null,
    })
    .returning();

  return match;
}

/**
 * Confirm a match by setting confirmedAt and confirmedBy.
 */
export async function confirmMatch(
  db: Db,
  tenantId: string,
  matchId: string,
  userId: string,
) {
  const [updated] = await db
    .update(bankReconMatches)
    .set({
      confirmedAt: new Date(),
      confirmedBy: userId,
    })
    .where(
      and(
        eq(bankReconMatches.id, matchId),
        eq(bankReconMatches.tenantId, tenantId),
      ),
    )
    .returning();

  return updated;
}

/**
 * Delete (unmatch) a reconciliation match.
 */
export async function deleteMatch(
  db: Db,
  tenantId: string,
  matchId: string,
) {
  const [deleted] = await db
    .delete(bankReconMatches)
    .where(
      and(
        eq(bankReconMatches.id, matchId),
        eq(bankReconMatches.tenantId, tenantId),
      ),
    )
    .returning();

  return deleted;
}

/**
 * Get reconciliation summary for a bank statement.
 */
export async function getReconSummary(
  db: Db,
  tenantId: string,
  bankStatementId: string,
): Promise<ReconSummary> {
  // Get statement balance
  const [stmt] = await db
    .select({
      balance: bankStatements.balance,
    })
    .from(bankStatements)
    .where(
      and(
        eq(bankStatements.id, bankStatementId),
        eq(bankStatements.tenantId, tenantId),
      ),
    )
    .limit(1);

  const statementBalance = Number(stmt?.balance ?? 0);

  // Count matched vs unmatched transactions
  const allTxns = await db
    .select({ id: bankTransactions.id })
    .from(bankTransactions)
    .where(eq(bankTransactions.bankStatementId, bankStatementId));

  const matchedTxns = await db
    .select({ id: bankReconMatches.bankTransactionId })
    .from(bankReconMatches)
    .innerJoin(
      bankTransactions,
      eq(bankReconMatches.bankTransactionId, bankTransactions.id),
    )
    .where(
      and(
        eq(bankReconMatches.tenantId, tenantId),
        eq(bankTransactions.bankStatementId, bankStatementId),
      ),
    );

  const matchedCount = matchedTxns.length;
  const unmatchedCount = allTxns.length - matchedCount;

  // Calculate GL balance from matched entries' journal lines
  const [glSum] = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.status, "posted"),
        eq(journalLines.accountCode, "1102"), // Default bank account code
      ),
    );

  const glBalance = Number(glSum?.totalDebit ?? 0) - Number(glSum?.totalCredit ?? 0);
  const difference = statementBalance - glBalance;

  return {
    statementBalance,
    glBalance,
    difference,
    matchedCount,
    unmatchedCount,
  };
}
