"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText, AlertTriangle } from "lucide-react";

import { ReportFilterBar } from "@/components/report-filter-bar";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportHistoryDrawer, type ReportHistoryItem } from "@/components/report-history-drawer";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

import { useTaxPnd53 } from "@/lib/hooks/use-tax-pnd53";
import {
  useReportHistory,
  useLockReport,
  useUnlockReport,
  useDeleteReport,
  useRestoreReport,
} from "@/lib/hooks/use-report-history";
import { useGenerateReportPdf } from "@/lib/hooks/use-report-pdf";
import { formatCurrency } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Pnd53Line {
  seq: number;
  payeeName: string;
  taxId: string;
  branch: string;
  paymentDate: string;
  incomeType: string;
  amount: number;
  whtRate: number;
  whtAmount: number;
  isUnmatched?: boolean;
}

interface Pnd53Data {
  totalWht: number;
  payeeCount: number;
  paymentCount: number;
  mostCommonRate: string;
  unmatchedCount: number;
  lines: Pnd53Line[];
  unmatchedLines: Pnd53Line[];
  totalPages?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_CONFIG = { showDepartment: false, showComparison: false };
const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function Pnd53Content() {
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const { data, isLoading } = useTaxPnd53({ period });
  const reportData = data as Pnd53Data | undefined;

  const history = useReportHistory({ reportType: "pnd53" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "pnd53",
      period,
      scope,
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope]);

  const unmatchedCount = reportData?.unmatchedCount ?? 0;

  const statCards = useMemo(() => [
    { label: "Total WHT", value: formatCurrency(reportData?.totalWht ?? 0), color: "border-l-[var(--primary)]" },
    { label: "# Payees", value: String(reportData?.payeeCount ?? 0), color: "border-l-[var(--success)]" },
    { label: "# Payments", value: String(reportData?.paymentCount ?? 0), color: "border-l-[var(--secondary)]" },
    {
      label: "Unmatched",
      value: String(unmatchedCount),
      color: unmatchedCount > 0 ? "border-l-[var(--warning)]" : "border-l-[var(--success)]",
    },
  ], [reportData, unmatchedCount]);

  const lines = useMemo(() => reportData?.lines ?? [], [reportData]);
  const unmatchedLines = useMemo(() => reportData?.unmatchedLines ?? [], [reportData]);

  const paginatedLines = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return lines.slice(start, start + PAGE_SIZE);
  }, [lines, page]);

  const totalPages = (reportData?.totalPages ?? Math.ceil(lines.length / PAGE_SIZE)) || 1;

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">{"\u0e20.\u0e07.\u0e14.53"} Corporate WHT</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{"\u0e2b\u0e31\u0e01 \u0e13 \u0e17\u0e35\u0e48\u0e08\u0e48\u0e32\u0e22\u0e19\u0e34\u0e15\u0e34\u0e1a\u0e38\u0e04\u0e04\u0e25"} &mdash; Withholding tax for corporate payees</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => window.history.back()}>
            All Reports
          </Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />}>Export</Button>
          <Button icon={<FileText className="h-4 w-4" />} onClick={handleGeneratePdf} loading={generatePdf.isPending}>
            Generate PDF
          </Button>
        </div>
      </div>

      <ReportStatCards items={statCards} isLoading={isLoading} />

      <ReportFilterBar
        config={FILTER_CONFIG}
        scope={scope}
        onScopeChange={setScope}
        period={period}
        onPeriodChange={setPeriod}
        lockedScope="monthly"
        onHistoryClick={() => setShowHistory(true)}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !lines.length && !unmatchedLines.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No PND53 data"
          description="There are no corporate WHT transactions for the selected period."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] w-10">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Payee</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Tax ID</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Branch</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Income Type</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Amount</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">WHT Rate</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">WHT Amount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLines.map((line) => (
                  <tr key={line.seq} className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
                    <td className="px-3 py-2.5 text-center tabular-nums text-[var(--muted-foreground)]">{line.seq}</td>
                    <td className="px-3 py-2.5 text-[var(--foreground)]">{line.payeeName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{line.taxId}</td>
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)]">{line.branch}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--muted-foreground)]">{line.paymentDate}</td>
                    <td className="px-3 py-2.5 text-[var(--foreground)]">{line.incomeType}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{line.whtRate}%</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(line.whtAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-t-[var(--foreground)] bg-[var(--muted)] font-bold">
                  <td colSpan={6} className="px-3 py-3 text-right text-[var(--foreground)]">Total</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrency(lines.reduce((s, l) => s + l.amount, 0))}
                  </td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(reportData?.totalWht ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}

          {/* Unmatched Section */}
          {unmatchedLines.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Unmatched Transactions
                </span>
                <Badge variant="action_required">{unmatchedLines.length} items</Badge>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                These transactions could not be matched to a specific payee type and default to PND53. Review and reclassify if needed.
              </p>
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--warning)]/30 bg-[var(--warning)]/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--warning)]/20 bg-[var(--warning)]/10">
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] w-10">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Payee</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Tax ID</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Income Type</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Amount</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">WHT Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedLines.map((line) => (
                      <tr key={`unmatched-${line.seq}`} className="border-b border-[var(--warning)]/10 hover:bg-[var(--warning)]/10">
                        <td className="px-3 py-2.5 text-center tabular-nums text-[var(--muted-foreground)]">{line.seq}</td>
                        <td className="px-3 py-2.5 text-[var(--foreground)]">{line.payeeName}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{line.taxId}</td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--muted-foreground)]">{line.paymentDate}</td>
                        <td className="px-3 py-2.5 text-[var(--foreground)]">{line.incomeType}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(line.whtAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <PdfPreviewModal isOpen={showPdfPreview} onClose={() => setShowPdfPreview(false)} pdfUrl={pdfUrl} />

      <ReportHistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        items={historyItems}
        isLoading={history.isLoading}
        activeFilter={historyFilter}
        onFilterChange={setHistoryFilter}
        onDownload={() => {}}
        onLock={(id) => lockReport.mutate(id)}
        onUnlock={(id) => unlockReport.mutate(id)}
        onDelete={(id) => deleteReport.mutate(id)}
        onRestore={(id) => restoreReport.mutate(id)}
        onPreview={() => {}}
      />
    </section>
  );
}

export default function Pnd53Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <Pnd53Content />
    </Suspense>
  );
}
