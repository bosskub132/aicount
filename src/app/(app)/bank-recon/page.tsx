"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  Landmark,
  Check,
  CheckCheck,
  Unlink,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Select } from "@/components/select";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ConfidenceBar } from "@/components/confidence-bar";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import {
  useBankRecon,
  useConfirmMatch,
  useDeleteMatch,
  useBulkConfirm,
} from "@/lib/hooks/use-bank-recon";
import { useBankStatements } from "@/lib/hooks/use-bank-recon-statements";
import { formatCurrency, formatDate } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BankTxnRow {
  id: string;
  transactionDate: string;
  description: string;
  debit: string;
  credit: string;
  referenceNo: string | null;
  matchId: string | null;
  matchedJournalEntryId: string | null;
  matchType: string | null;
  confidence: string | null;
  confirmedAt: string | null;
}

interface GLEntryRow {
  journalEntryId: string;
  date: string;
  jvNumber: string;
  description: string;
  debit: string;
  credit: string;
}

interface MatchSuggestion {
  bankTransactionId: string;
  journalEntryId: string;
  confidence: number;
}

interface ReconData {
  bankTransactions: BankTxnRow[];
  unmatchedGLEntries: GLEntryRow[];
  suggestions: MatchSuggestion[];
  summary: {
    statementBalance: number;
    glBalance: number;
    difference: number;
    matchedCount: number;
    unmatchedCount: number;
  };
}

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams)
// ---------------------------------------------------------------------------

function BankReconContent() {
  const mounted = useMounted();
  const tenantId = getWorkspaceTenantId();
  const searchParams = useSearchParams();
  const paramStatementId = searchParams.get("statementId");

  const [selectedStatementId, setSelectedStatementId] = useState<string>(
    paramStatementId ?? "",
  );
  const [selectedBankTxnId, setSelectedBankTxnId] = useState<string | null>(null);

  const confirmMatch = useConfirmMatch(tenantId);
  const deleteMatch = useDeleteMatch(tenantId);
  const bulkConfirm = useBulkConfirm(tenantId);

  const { data: reconData, isLoading: queryLoading, isError } = useBankRecon(
    tenantId,
    selectedStatementId || null,
  );

  const isLoading = !mounted || queryLoading;

  const data = reconData as ReconData | undefined;

  // Stable reference for suggestions
  const suggestions = data?.suggestions;

  // Build suggestion lookup: bankTransactionId -> suggestion
  const suggestionMap = useMemo(() => {
    const map = new Map<string, MatchSuggestion>();
    if (suggestions) {
      for (const s of suggestions) {
        map.set(s.bankTransactionId, s);
      }
    }
    return map;
  }, [suggestions]);

  // High-confidence suggestions (>= 0.8) that are not yet matched
  const highConfidenceSuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.filter((s) => s.confidence >= 0.8);
  }, [suggestions]);

  // Manual match: select bank txn, then click GL entry
  const handleManualMatch = useCallback(
    (glEntryId: string) => {
      if (!selectedBankTxnId) return;
      confirmMatch.mutate({
        bankTransactionId: selectedBankTxnId,
        journalEntryId: glEntryId,
        matchType: "manual",
      });
      setSelectedBankTxnId(null);
    },
    [selectedBankTxnId, confirmMatch],
  );

  const handleConfirmSuggestion = useCallback(
    (suggestion: MatchSuggestion) => {
      confirmMatch.mutate({
        bankTransactionId: suggestion.bankTransactionId,
        journalEntryId: suggestion.journalEntryId,
        matchType: "auto",
      });
    },
    [confirmMatch],
  );

  const handleConfirmAll = useCallback(() => {
    if (highConfidenceSuggestions.length === 0) return;
    bulkConfirm.mutate(
      highConfidenceSuggestions.map((s) => ({
        bankTransactionId: s.bankTransactionId,
        journalEntryId: s.journalEntryId,
        matchType: "auto" as const,
      })),
    );
  }, [highConfidenceSuggestions, bulkConfirm]);

  const handleUnmatch = useCallback(
    (matchId: string) => {
      deleteMatch.mutate(matchId);
    },
    [deleteMatch],
  );

  if (!tenantId) {
    return (
      <EmptyState
        icon={<Landmark className="h-10 w-10" />}
        title="No workspace selected"
        description="Select a workspace to view bank reconciliation."
      />
    );
  }

  const summary = data?.summary;
  const bankTxns = data?.bankTransactions ?? [];
  const unmatchedGL = data?.unmatchedGLEntries ?? [];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Bank Reconciliation
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            กระทบยอดธนาคาร
          </p>
        </div>

        <div className="flex items-center gap-3">
          <BankStatementSelect
            tenantId={tenantId}
            value={selectedStatementId}
            onChange={setSelectedStatementId}
          />
          {highConfidenceSuggestions.length > 0 && (
            <Button
              variant="primary"
              onClick={handleConfirmAll}
              disabled={bulkConfirm.isPending}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Confirm All ({highConfidenceSuggestions.length})
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary Bar ─────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryCard
            label="Statement Balance"
            value={formatCurrency(summary.statementBalance)}
          />
          <SummaryCard
            label="GL Balance"
            value={formatCurrency(summary.glBalance)}
          />
          <SummaryCard
            label="Difference"
            value={formatCurrency(summary.difference)}
            variant={summary.difference === 0 ? "success" : "danger"}
          />
          <SummaryCard
            label="Matched"
            value={String(summary.matchedCount)}
          />
          <SummaryCard
            label="Unmatched"
            value={String(summary.unmatchedCount)}
            variant={summary.unmatchedCount > 0 ? "warning" : "success"}
          />
        </div>
      )}

      {/* ── Loading / Error / Empty ─────────────────────────────────── */}
      {!selectedStatementId && (
        <EmptyState
          icon={<Landmark className="h-10 w-10" />}
          title="Select a bank statement"
          description="Choose a bank statement above to start reconciliation."
        />
      )}

      {selectedStatementId && isLoading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      )}

      {selectedStatementId && isError && (
        <EmptyState
          icon={<AlertCircle className="h-10 w-10" />}
          title="Failed to load data"
          description="Could not fetch reconciliation data. Please try again."
        />
      )}

      {/* ── Split View ──────────────────────────────────────────────── */}
      {selectedStatementId && !isLoading && !isError && data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Bank Statement Transactions */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Bank Statement Transactions
              </h2>
              {selectedBankTxnId && (
                <p className="mt-1 text-xs text-[var(--primary)]">
                  Click a GL entry on the right to match
                </p>
              )}
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {bankTxns.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">
                  No transactions found
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--surface-card)]">
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2 text-right">Debit</th>
                      <th className="px-4 py-2 text-right">Credit</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankTxns.map((txn) => {
                      const isMatched = !!txn.matchId;
                      const suggestion = suggestionMap.get(txn.id);
                      const isSelected = selectedBankTxnId === txn.id;

                      return (
                        <tr
                          key={txn.id}
                          className={`border-b border-[var(--border)] transition-colors ${
                            isMatched
                              ? "opacity-50"
                              : isSelected
                                ? "bg-[var(--primary)]/10"
                                : "cursor-pointer hover:bg-[var(--surface-hover)]"
                          }`}
                          onClick={() => {
                            if (!isMatched) {
                              setSelectedBankTxnId(
                                isSelected ? null : txn.id,
                              );
                            }
                          }}
                        >
                          <td className="px-4 py-2 whitespace-nowrap">
                            {formatDate(txn.transactionDate)}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2">
                            {txn.description}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {Number(txn.debit) > 0
                              ? formatCurrency(txn.debit)
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {Number(txn.credit) > 0
                              ? formatCurrency(txn.credit)
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isMatched ? (
                              <div className="flex items-center justify-center gap-1">
                                <Badge variant="approved">Matched</Badge>
                                <button
                                  className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                                  title="Unmatch"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnmatch(txn.matchId!);
                                  }}
                                >
                                  <Unlink className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : suggestion ? (
                              <div className="flex items-center justify-center gap-1">
                                <ConfidenceBar
                                  score={suggestion.confidence}
                                  size="sm"
                                  showLabel={false}
                                />
                                <button
                                  className="text-[var(--primary)] hover:text-[var(--primary-hover)]"
                                  title="Confirm suggestion"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmSuggestion(suggestion);
                                  }}
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <Badge variant="default">Unmatched</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right: Unmatched GL Entries */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Unmatched GL Entries
              </h2>
              {selectedBankTxnId && (
                <p className="mt-1 text-xs text-[var(--primary)]">
                  Click an entry to match with selected transaction
                </p>
              )}
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {unmatchedGL.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">
                  No unmatched GL entries
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--surface-card)]">
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">JV No</th>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2 text-right">Debit</th>
                      <th className="px-4 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedGL.map((gl) => {
                      // Highlight if this GL entry is suggested for the selected bank txn
                      const isSuggested =
                        selectedBankTxnId &&
                        suggestionMap.get(selectedBankTxnId)?.journalEntryId ===
                          gl.journalEntryId;

                      return (
                        <tr
                          key={gl.journalEntryId}
                          className={`border-b border-[var(--border)] transition-colors ${
                            isSuggested
                              ? "bg-[var(--success)]/10"
                              : selectedBankTxnId
                                ? "cursor-pointer hover:bg-[var(--surface-hover)]"
                                : ""
                          }`}
                          onClick={() => {
                            if (selectedBankTxnId) {
                              handleManualMatch(gl.journalEntryId);
                            }
                          }}
                        >
                          <td className="px-4 py-2 whitespace-nowrap">
                            {formatDate(gl.date)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">
                            {gl.jvNumber}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2">
                            {gl.description}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {Number(gl.debit) > 0
                              ? formatCurrency(gl.debit)
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {Number(gl.credit) > 0
                              ? formatCurrency(gl.credit)
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "success" | "danger" | "warning";
}) {
  const colorMap = {
    default: "text-[var(--foreground)]",
    success: "text-[var(--success)]",
    danger: "text-[var(--destructive)]",
    warning: "text-[var(--warning)]",
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${colorMap[variant]}`}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bank Statement Select — fetches available statements
// ---------------------------------------------------------------------------

function BankStatementSelect({
  tenantId,
  value,
  onChange,
}: {
  tenantId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: statements } = useBankStatements(tenantId);

  const options = useMemo(() => {
    if (!statements || !Array.isArray(statements)) return [];
    return statements.map(
      (s: { id: string; statementDate: string; balance: string | null }) => ({
        value: s.id,
        label: `${s.statementDate}${s.balance ? ` (${formatCurrency(s.balance)})` : ""}`,
      }),
    );
  }, [statements]);

  return (
    <div className="w-64">
      <Select
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Select bank statement..."
        searchable
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (wrapped in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function BankReconPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      }
    >
      <BankReconContent />
    </Suspense>
  );
}
