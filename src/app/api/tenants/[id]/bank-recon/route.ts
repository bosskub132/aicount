import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import {
  getAllBankTransactions,
  getUnmatchedGLEntries,
  getReconSummary,
} from "@/lib/db/queries/bank-recon";
import { autoMatch } from "@/lib/services/bank-matching";
import type { BankTransaction, GLEntry } from "@/lib/services/bank-matching";

/**
 * GET /api/tenants/[id]/bank-recon?bankStatementId=...
 * Returns bank transactions, unmatched GL entries, auto-match suggestions, and summary.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

  const url = new URL(request.url);
  const bankStatementId = url.searchParams.get("bankStatementId");

  if (!bankStatementId) {
    return NextResponse.json(
      { success: false, error: "bankStatementId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    // Fetch all bank transactions (with match status)
    const allTxns = await getAllBankTransactions(db, id, bankStatementId);

    // Determine date range from transactions for GL lookup
    const txnDates = allTxns.map((t) => t.transactionDate);
    if (txnDates.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          bankTransactions: [],
          unmatchedGLEntries: [],
          suggestions: [],
          summary: { statementBalance: 0, glBalance: 0, difference: 0, matchedCount: 0, unmatchedCount: 0 },
        },
      });
    }

    const sortedDates = [...txnDates].sort();
    const dateFrom = sortedDates[0];
    const dateTo = sortedDates[sortedDates.length - 1];

    // Extend date range by 3 days for matching window
    const extendedFrom = new Date(dateFrom);
    extendedFrom.setDate(extendedFrom.getDate() - 3);
    const extendedTo = new Date(dateTo);
    extendedTo.setDate(extendedTo.getDate() + 3);

    const bankAccountCode = "1102"; // Default bank account code

    // Fetch unmatched GL entries and summary in parallel
    const [unmatchedGL, summary] = await Promise.all([
      getUnmatchedGLEntries(
        db,
        id,
        bankAccountCode,
        extendedFrom.toISOString().slice(0, 10),
        extendedTo.toISOString().slice(0, 10),
      ),
      getReconSummary(db, id, bankStatementId),
    ]);

    // Prepare data for auto-matching
    const unmatchedBankTxns: BankTransaction[] = allTxns
      .filter((t) => !t.matchId)
      .map((t) => ({
        id: t.id,
        transactionDate: t.transactionDate,
        description: t.description,
        debit: t.debit,
        credit: t.credit,
        referenceNo: t.referenceNo,
      }));

    const glEntries: GLEntry[] = unmatchedGL.map((g) => ({
      journalEntryId: g.journalEntryId,
      date: g.date,
      jvNumber: g.jvNumber,
      description: g.description,
      debit: g.debit,
      credit: g.credit,
    }));

    const suggestions = autoMatch(unmatchedBankTxns, glEntries);

    return NextResponse.json({
      success: true,
      data: {
        bankTransactions: allTxns,
        unmatchedGLEntries: unmatchedGL,
        suggestions,
        summary,
      },
    });
  } catch (error) {
    console.error("Failed to fetch bank reconciliation data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch bank reconciliation data" },
      { status: 500 },
    );
  }
}
