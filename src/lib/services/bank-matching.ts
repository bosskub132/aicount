// ── Bank Auto-Matching Service ───────────────────────────────────────────────

export interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  debit: string;
  credit: string;
  referenceNo: string | null;
  isMatched?: boolean;
}

export interface GLEntry {
  journalEntryId: string;
  date: string;
  jvNumber: string;
  description: string;
  debit: string;
  credit: string;
  isMatched?: boolean;
}

export interface MatchSuggestion {
  bankTransactionId: string;
  journalEntryId: string;
  confidence: number; // 0.00 - 1.00
}

/**
 * Calculate the net amount for a bank transaction (credit - debit, positive = inflow).
 */
function bankTxnAmount(txn: BankTransaction): number {
  return Number(txn.credit) - Number(txn.debit);
}

/**
 * Calculate the net amount for a GL entry (debit - credit, positive = debit balance).
 */
function glEntryAmount(entry: GLEntry): number {
  return Number(entry.debit) - Number(entry.credit);
}

/**
 * Calculate the absolute day difference between two date strings (YYYY-MM-DD).
 */
function dayDifference(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs(Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Confidence based on day difference:
 *  - same day: 1.0
 *  - ±1 day:   0.9
 *  - ±2 days:  0.8
 *  - ±3 days:  0.7
 */
function confidenceFromDays(days: number): number {
  if (days === 0) return 1.0;
  if (days === 1) return 0.9;
  if (days === 2) return 0.8;
  if (days === 3) return 0.7;
  return 0;
}

/**
 * Auto-match bank transactions to GL entries.
 *
 * Logic: for each unmatched bank txn, find GL entries with exact amount match
 * (bank inflow matches GL credit side or bank outflow matches GL debit side)
 * within a ±3 day window.
 *
 * Returns only the best match per bank transaction (highest confidence).
 * Skips already-matched transactions.
 */
export function autoMatch(
  bankTransactions: BankTransaction[],
  glEntries: GLEntry[],
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  const usedGLEntryIds = new Set<string>();

  // Filter out already-matched items
  const unmatchedTxns = bankTransactions.filter((t) => !t.isMatched);
  const unmatchedGL = glEntries.filter((g) => !g.isMatched);

  for (const txn of unmatchedTxns) {
    const txnAmount = bankTxnAmount(txn);
    let bestMatch: MatchSuggestion | null = null;

    for (const gl of unmatchedGL) {
      if (usedGLEntryIds.has(gl.journalEntryId)) continue;

      // Bank inflow (positive) should match GL debit (positive net = debit > credit)
      // Bank outflow (negative) should match GL credit (negative net = credit > debit)
      // In both cases, the absolute amounts should match
      const glAmount = glEntryAmount(gl);

      // Amount match: bank credit-debit should equal gl debit-credit (opposite sides)
      // A bank deposit matches a GL debit entry; a bank withdrawal matches a GL credit entry
      if (Math.abs(Math.abs(txnAmount) - Math.abs(glAmount)) > 0.01) continue;

      // Check signs match: bank inflow (txnAmount > 0) matches GL debit (glAmount > 0)
      // bank outflow (txnAmount < 0) matches GL credit (glAmount < 0)
      if ((txnAmount > 0) !== (glAmount > 0) && txnAmount !== 0) continue;

      const days = dayDifference(txn.transactionDate, gl.date);
      if (days > 3) continue;

      const confidence = confidenceFromDays(days);

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          bankTransactionId: txn.id,
          journalEntryId: gl.journalEntryId,
          confidence,
        };
      }
    }

    if (bestMatch) {
      suggestions.push(bestMatch);
      usedGLEntryIds.add(bestMatch.journalEntryId);
    }
  }

  return suggestions;
}
