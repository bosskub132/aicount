"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText, CheckCircle, AlertTriangle } from "lucide-react";

import { ReportFilterBar } from "@/components/report-filter-bar";
import { ReportStatCards } from "@/components/report-stat-cards";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ReportHistoryDrawer, type ReportHistoryItem } from "@/components/report-history-drawer";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

import { useBalanceSheet } from "@/lib/hooks/use-balance-sheet";
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

interface BsRow {
  accountCode: string;
  accountName: string;
  section: "asset" | "liability" | "equity";
  amount: number;
  comparisonAmount?: number;
}

interface BsData {
  rows: BsRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings?: number;
  isBalanced: boolean;
  comparisonTotalAssets?: number;
  comparisonTotalLiabilities?: number;
  comparisonTotalEquity?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_CONFIG = { showComparison: true };

const SECTION_CONFIG: { key: "asset" | "liability" | "equity"; label: string; bgClass: string; textClass: string }[] = [
  { key: "asset", label: "Assets", bgClass: "bg-blue-50", textClass: "text-blue-700" },
  { key: "liability", label: "Liabilities", bgClass: "bg-red-50", textClass: "text-red-700" },
  { key: "equity", label: "Equity", bgClass: "bg-purple-50", textClass: "text-purple-700" },
];

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function BalanceSheetContent() {
  const [scope, setScope] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [comparison, setComparison] = useState("none");
  const [showHistory, setShowHistory] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "locked" | "drafts" | "trash">("all");

  const { data, isLoading } = useBalanceSheet({
    period,
    scope,
    comparison: comparison !== "none" ? comparison : undefined,
  });

  const reportData = data as BsData | undefined;
  const hasComparison = comparison !== "none";

  const history = useReportHistory({ reportType: "balance-sheet" });
  const generatePdf = useGenerateReportPdf();
  const lockReport = useLockReport();
  const unlockReport = useUnlockReport();
  const deleteReport = useDeleteReport();
  const restoreReport = useRestoreReport();

  const handleGeneratePdf = useCallback(async () => {
    const result = await generatePdf.mutateAsync({
      reportType: "balance-sheet",
      period,
      scope,
      filters: { comparison },
    });
    setPdfUrl(result.pdfUrl);
    setShowPdfPreview(true);
  }, [generatePdf, period, scope, comparison]);

  const statCards = useMemo(() => {
    const balanced = reportData?.isBalanced ?? true;
    return [
      { label: "Total Assets", value: formatCurrency(reportData?.totalAssets ?? 0), color: "border-l-[var(--primary)]" },
      { label: "Total Liabilities", value: formatCurrency(reportData?.totalLiabilities ?? 0), color: "border-l-[var(--destructive)]" },
      { label: "Total Equity", value: formatCurrency(reportData?.totalEquity ?? 0), color: "border-l-[var(--warning)]" },
      {
        label: "A = L + E",
        value: balanced ? "Balanced" : "Imbalanced",
        color: balanced ? "border-l-[var(--success)]" : "border-l-[var(--destructive)]",
      },
    ];
  }, [reportData]);

  const sectionTotals: Record<string, number> = useMemo(() => ({
    asset: reportData?.totalAssets ?? 0,
    liability: reportData?.totalLiabilities ?? 0,
    equity: reportData?.totalEquity ?? 0,
  }), [reportData]);

  const comparisonTotals: Record<string, number> = useMemo(() => ({
    asset: reportData?.comparisonTotalAssets ?? 0,
    liability: reportData?.comparisonTotalLiabilities ?? 0,
    equity: reportData?.comparisonTotalEquity ?? 0,
  }), [reportData]);

  const historyItems: ReportHistoryItem[] = useMemo(() => {
    const items = (history.data as { items?: ReportHistoryItem[] })?.items;
    return items ?? [];
  }, [history.data]);

  return (
    <section className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Balance Sheet</h1>
          <p className="text-sm text-[var(--muted-foreground)]">งบแสดงฐานะการเงิน &mdash; Assets, liabilities, and equity</p>
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
        comparison={comparison}
        onComparisonChange={setComparison}
        onHistoryClick={() => setShowHistory(true)}
      />

      {/* Balance check banner */}
      {!isLoading && reportData && (
        <div
          className={`flex items-center gap-2 rounded-[var(--radius-card)] px-4 py-2.5 text-sm font-medium ${
            reportData.isBalanced
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {reportData.isBalanced ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {reportData.isBalanced
            ? "Assets equal Liabilities + Equity. The balance sheet is balanced."
            : "Warning: Assets do not equal Liabilities + Equity. Please review entries."}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rect" height="40px" />)}
        </div>
      ) : !reportData?.rows?.length ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No balance sheet data"
          description="There are no journal entries for the selected period."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Account</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Amount</th>
                {hasComparison && (
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Comparison</th>
                )}
              </tr>
            </thead>
            <tbody>
              {SECTION_CONFIG.map((sec) => {
                const sectionRows = reportData.rows.filter((r) => r.section === sec.key);
                if (sectionRows.length === 0) return null;
                return (
                  <SectionBlock
                    key={sec.key}
                    label={sec.label}
                    bgClass={sec.bgClass}
                    textClass={sec.textClass}
                    rows={sectionRows}
                    total={sectionTotals[sec.key]}
                    comparisonTotal={hasComparison ? comparisonTotals[sec.key] : undefined}
                    hasComparison={hasComparison}
                    retainedEarnings={sec.key === "equity" ? reportData.retainedEarnings : undefined}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
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

// ---------------------------------------------------------------------------
// Section Block sub-component
// ---------------------------------------------------------------------------

function SectionBlock({
  label,
  bgClass,
  textClass,
  rows,
  total,
  comparisonTotal,
  hasComparison,
  retainedEarnings,
}: {
  label: string;
  bgClass: string;
  textClass: string;
  rows: BsRow[];
  total: number;
  comparisonTotal?: number;
  hasComparison: boolean;
  retainedEarnings?: number;
}) {
  return (
    <>
      <tr className={bgClass}>
        <td colSpan={hasComparison ? 3 : 2} className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${textClass}`}>
          {label}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.accountCode} className="border-b border-[var(--muted)] hover:bg-[var(--muted)]/30">
          <td className="px-4 py-2.5 pl-8 text-[var(--foreground)]">
            <span className="font-mono text-xs text-[var(--muted-foreground)] mr-2">{row.accountCode}</span>
            {row.accountName}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.amount)}</td>
          {hasComparison && (
            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.comparisonAmount ?? 0)}</td>
          )}
        </tr>
      ))}
      {retainedEarnings !== undefined && (
        <tr className="border-b border-[var(--muted)] bg-purple-50/30 italic">
          <td className="px-4 py-2.5 pl-8 text-[var(--foreground)]">Retained Earnings</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(retainedEarnings)}</td>
          {hasComparison && <td className="px-4 py-2.5 text-right tabular-nums">&mdash;</td>}
        </tr>
      )}
      <tr className={`border-b border-[var(--border)] ${bgClass} font-semibold`}>
        <td className={`px-4 py-2 text-right ${textClass}`}>Total {label}</td>
        <td className={`px-4 py-2 text-right tabular-nums ${textClass}`}>{formatCurrency(total)}</td>
        {hasComparison && (
          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(comparisonTotal ?? 0)}</td>
        )}
      </tr>
    </>
  );
}

export default function BalanceSheetPage() {
  return (
    <Suspense fallback={<Skeleton variant="rect" height="400px" />}>
      <BalanceSheetContent />
    </Suspense>
  );
}
